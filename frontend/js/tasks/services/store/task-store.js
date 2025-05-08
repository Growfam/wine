/**
 * Сховище стану завдань
 *
 * Відповідає за:
 * - Зберігання завдань
 * - Зберігання прогресу
 * - Управління станом системи
 */

import { TASK_TYPES } from '../../config';
import { createTaskModel } from '../../models';
import { saveToCache, loadFromCache } from './cache-handlers';

class TaskStore {
  constructor() {
    // Колекції завдань за типами
    this.tasks = {
      [TASK_TYPES.SOCIAL]: [],
      [TASK_TYPES.LIMITED]: [],
      [TASK_TYPES.PARTNER]: [],
      [TASK_TYPES.REFERRAL]: [],
    };

    // Поточний прогрес користувача
    this.userProgress = {};

    // Балансы користувача
    this.userBalances = {
      tokens: null,
      coins: null,
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
      USER_PROGRESS: 'task_progress',
      ACTIVE_TAB: 'active_tasks_tab',
      BALANCES: 'user_balances',
      DAILY_BONUS_INFO: 'daily_bonus_info',
    };

    // Час життя кешу для різних типів даних
    this.CACHE_TTL = {
      TASKS: 600000, // 10 хвилин
      PROGRESS: 86400000, // 24 години
      BALANCES: 300000, // 5 хвилин
      DAILY_BONUS: 43200000, // 12 годин
    };
  }

  /**
   * Ініціалізація сховища
   */
  initialize() {
    if (this.systemState.initialized) return;

    // Завантажуємо прогрес з кешу
    loadFromCache(this);

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
    document.dispatchEvent(
      new CustomEvent('task-store-update', {
        detail: { action, data },
      })
    );
  }

  /**
   * Завантаження балансів користувача
   */
  loadBalances() {
    try {
      // Спочатку спробуємо завантажити з кешу
      const cachedBalances = loadFromCache(this.CACHE_KEYS.BALANCES);
      if (cachedBalances) {
        this.userBalances = cachedBalances;
      }

      // Далі пробуємо з DOM
      const tokensElement = document.getElementById('user-tokens');
      if (tokensElement) {
        this.userBalances.tokens = parseFloat(tokensElement.textContent) || 0;
      }

      const coinsElement = document.getElementById('user-coins');
      if (coinsElement) {
        this.userBalances.coins = parseInt(coinsElement.textContent) || 0;
      }

      // Зберігаємо оновлені баланси в кеш
      saveToCache(this.CACHE_KEYS.BALANCES, this.userBalances, {
        ttl: this.CACHE_TTL.BALANCES,
        tags: ['user', 'balances'],
      });
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

      // Зберігаємо в кеш
      saveToCache('userTokens', this.userBalances.tokens.toString());
      saveToCache('winix_balance', this.userBalances.tokens.toString());
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

      // Зберігаємо в кеш
      saveToCache('userCoins', this.userBalances.coins.toString());
      saveToCache('winix_coins', this.userBalances.coins.toString());
    }

    // Оновлюємо кеш балансів
    saveToCache(this.CACHE_KEYS.BALANCES, this.userBalances, {
      ttl: this.CACHE_TTL.BALANCES,
      tags: ['user', 'balances'],
    });

    // Сповіщаємо підписників
    this.notifySubscribers('balance-updated', {
      type,
      amount: normalizedAmount,
      isIncrement,
      newBalance: type === 'tokens' ? this.userBalances.tokens : this.userBalances.coins,
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
  setTaskProgress(taskId, progressData) {
    // Перевіряємо валідність даних
    if (!taskId || !progressData) {
      console.warn('Некоректні дані прогресу');
      return;
    }

    // Зберігаємо прогрес
    this.userProgress[taskId] = progressData;

    // Зберігаємо в кеш
    saveToCache(this.CACHE_KEYS.USER_PROGRESS, this.userProgress);

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

    // Зберігаємо в кеш
    saveToCache(this.CACHE_KEYS.USER_PROGRESS, this.userProgress);

    // Сповіщаємо підписників
    this.notifySubscribers('all-progress-updated', { progress: this.userProgress });
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

export default TaskStore;
