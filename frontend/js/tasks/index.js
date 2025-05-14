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

// Оголошуємо глобальну змінну для використання в інших модулях
let dependencyContainer = null;

/**
 * Асинхронна функція для ініціалізації контейнера залежностей
 * @returns {Promise<Object>} Проміс, що повертає контейнер залежностей
 */
export async function initializeDependencies() {
  try {
    // Перевіряємо, чи контейнер вже був ініціалізований
    if (dependencyContainer !== null) {
      console.log('✅ DependencyContainer вже завантажено');
      return dependencyContainer;
    }

    // Динамічний імпорт для розриву циклу
    const module = await import('./utils/core/dependency.js');
    dependencyContainer = module.default;
    console.log('✅ DependencyContainer успішно завантажено');

    // Реєструємо TaskManager і TaskSystem у контейнері
    registerTaskSystemInContainer();

    return dependencyContainer;
  } catch (e) {
    console.error('❌ Помилка завантаження DependencyContainer:', e);
    throw e;
  }
}

/**
 * Функція для реєстрації системи завдань у контейнері залежностей
 */
function registerTaskSystemInContainer() {
  if (!dependencyContainer || typeof dependencyContainer.register !== 'function') {
    console.error('❌ DependencyContainer не ініціалізований або не має методу register');
    return;
  }

  try {
    // Реєструємо TaskManager у контейнері залежностей
    if (window.TaskManager) {
      dependencyContainer.register('TaskManager', window.TaskManager);
      console.log('✅ TaskManager зареєстровано в контейнері залежностей');
    }

    // Реєструємо TaskSystem у контейнері залежностей
    if (window.WINIX && window.WINIX.tasks) {
      dependencyContainer.register('TaskSystem', window.WINIX.tasks);
      console.log('✅ TaskSystem зареєстровано в контейнері залежностей');
    }
  } catch (e) {
    console.error('❌ Помилка реєстрації систем у контейнері залежностей:', e);
  }
}

// Виклик функції ініціалізації відразу з синхронним обробником
initializeDependencies().then(() => {
  console.log('✅ Залежності ініціалізовано, можна продовжувати');
}).catch(error => {
  console.error('❌ Помилка ініціалізації залежностей:', error);
  // Спробуємо ще раз через деякий час
  setTimeout(() => {
    initializeDependencies().catch(e =>
      console.error('❌ Повторна спроба ініціалізації залежностей невдала:', e)
    );
  }, 1000);
});

// Експортуємо контейнер залежностей
export { dependencyContainer };

import { getLogger } from './utils/core/logger.js';

// Створюємо логер для основної системи
const logger = getLogger('TaskSystem');

// Імпорт API (без створення циклічних залежностей)
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

// Для використання в сучасному синтаксисі
window.WINIX = window.WINIX || {};
window.WINIX.tasks = taskSystem;

// Експортуємо для використання в модулях
export default taskSystem;

// Експортуємо окремі компоненти для розширеного використання
export { taskApi };