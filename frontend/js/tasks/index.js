/**
 * Точка входу системи завдань WINIX
 *
 * Ініціалізує всі модулі та експортує публічне API
 * @version 3.1.0
 */

// Імпорт функцій з підсистеми ініціалізації
import {
  initializeSystem,
  loadModules,
  getTasks,
  findTaskById,
  startTask,
  verifyTask,
  updateTaskProgress,
  getTaskProgress,
  syncProgress,
  claimDailyBonus,
  setActiveTab,
  updateBalance,
  getSystemState,
  resetState,
  dispatchSystemEvent
} from './initialization/index.js';

// Імпорт фабрики сервісів для ініціалізації
import { serviceFactory } from './utils/index.js';
console.log('Фабрика сервісів ініціалізована:', !!serviceFactory);

// ВИПРАВЛЕНО: імпорт конфігурації з правильним шляхом
import * as TaskTypes from './config/types/index.js';
import { CONFIG } from './config/settings.js';

// Імпорт контейнера залежностей
import dependencyContainer from './utils/core/dependency.js';
import { getLogger } from './utils/core/logger.js';

// Створюємо логер для основної системи
const logger = getLogger('TaskSystem');

// Імпорт API (без створення циркулярних залежностей)
import taskApi from './api/index.js';

// Визначення версії
const VERSION = '3.1.0';

// Експортуємо API для модульного використання
const taskSystem = {
  // Дані про версію
  version: VERSION,

  // Методи ініціалізації
  initialize: initializeSystem,
  loadModules,

  // Основні методи роботи з завданнями
  getTasks,
  findTaskById,
  startTask,
  verifyTask,
  updateTaskProgress,
  getTaskProgress,
  syncProgress,

  // Методи для щоденних бонусів
  claimDailyBonus,

  // Методи роботи з UI та станом
  setActiveTab,
  updateBalance,
  getSystemState,
  resetState,
  dispatchSystemEvent,

  // Типи та конфігурація
  types: TaskTypes,
  config: CONFIG,

  // Доступ до API
  api: taskApi
};

// Автоматична ініціалізація при завантаженні сторінки
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      logger.debug('DOM завантажено, автоматична ініціалізація TaskSystem');
      setTimeout(() => initializeSystem(), 100);
    });
  } else {
    // DOM вже завантажено
    logger.debug('DOM вже завантажено, автоматична ініціалізація TaskSystem');
    setTimeout(() => initializeSystem(), 100);
  }
}

// Для зворотної сумісності з глобальним namespace
window.TaskManager = {
  // Основні методи
  init: initializeSystem,
  loadTasks: () => initializeSystem({ forceRefresh: true }),
  findTaskById,
  startTask,
  verifyTask,
  updateTaskProgress,
  getTaskProgress,
  claimDailyBonus,

  // Додаткові методи
  diagnoseSystemState: getSystemState,
  refreshAllTasks: () => initializeSystem({ forceRefresh: true }),
  showErrorMessage: (message) => {
    // Для сумісності з попередньою версією
    console.error(message);
    return false;
  },
  showSuccessMessage: (message) => {
    // Для сумісності з попередньою версією
    console.log(message);
    return true;
  },

  // Властивості
  get initialized() {
    return getSystemState().initialized;
  },
  get version() {
    return VERSION;
  },
  REWARD_TYPES: TaskTypes.REWARD_TYPES,
};

// Реєструємо TaskManager у контейнері залежностей
dependencyContainer.register('TaskManager', window.TaskManager);

// Для використання в сучасному синтаксисі
window.WINIX = window.WINIX || {};
window.WINIX.tasks = taskSystem;

// Експортуємо для використання в модулях
export default taskSystem;

// Експортуємо окремі компоненти для розширеного використання
export { taskApi };