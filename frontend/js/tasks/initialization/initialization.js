/**
 * Ініціалізація системи завдань WINIX
 *
 * Відповідає за:
 * - Ініціалізацію всіх компонентів системи
 * - Завантаження даних завдань
 * - Встановлення з'єднань між компонентами
 * 
 * @version 3.1.0
 */

import * as TaskTypes from '../config/index.js';
import dependencyContainer from '../utils/core/dependency.js';
import { getLogger } from '../utils/core/logger.js';
import { loadModules } from './module-loader.js';

// Створюємо логер для ініціалізації
const logger = getLogger('TaskInitialization');

/**
 * Ініціалізація всієї системи завдань
 * @param {Object} options - Опції ініціалізації
 * @returns {Promise<boolean>} Результат ініціалізації
 */
export async function initialize(options = {}) {
  try {
    logger.info('Початок ініціалізації', 'initialize', { options });

    // Завантажуємо всі необхідні модулі
    const moduleCache = await loadModules();

    // Отримуємо сервіси із кешу модулів
    const { taskStore, taskVerification, taskProgress, dailyBonusService } = moduleCache.services;
    const api = moduleCache.api;

    // Реєстрація основних модулів у контейнері залежностей
    dependencyContainer
      .register('taskApi', api)
      .register('taskStore', taskStore)
      .register('taskVerification', taskVerification)
      .register('taskProgress', taskProgress)
      .register('dailyBonusService', dailyBonusService);

    // Ініціалізуємо сховище
    if (typeof taskStore.initialize === 'function') {
      taskStore.initialize(options.store);
    }

    // Ініціалізуємо модуль прогресу
    if (typeof taskProgress.initialize === 'function') {
      taskProgress.initialize(options.progress);
    }

    // Ініціалізуємо щоденні бонуси
    if (typeof dailyBonusService.initialize === 'function') {
      dailyBonusService.initialize(options.dailyBonus);
    }

    // Завантажуємо завдання
    await loadInitialTasks(api, taskStore, options);

    // Ін'єктуємо посилання на TaskSystem
    injectSystemReference(api, taskStore, taskProgress, taskVerification, dailyBonusService);

    // Генеруємо подію ініціалізації
    dispatchSystemEvent('initialized', {
      version: '3.1.0',
    });

    logger.info('Ініціалізацію завершено успішно', 'initialize');
    return true;
  } catch (error) {
    logger.error('Критична помилка ініціалізації', 'initialize', { error });

    // Генеруємо подію помилки
    dispatchSystemEvent('initialization-error', {
      error: error.message,
    });

    return false;
  }
}

/**
 * Завантаження початкових даних завдань
 * @param {Object} api - API для роботи з завданнями
 * @param {Object} taskStore - Сховище завдань
 * @param {Object} options - Опції ініціалізації
 * @returns {Promise<boolean>} Результат завантаження
 */
async function loadInitialTasks(api, taskStore, options) {
  try {
    const tasksData = await api.getAllTasks({
      forceRefresh: options.forceRefresh || false,
    });

    // Зберігаємо завдання у сховище
    taskStore.setTasks(TaskTypes.TASK_TYPES.SOCIAL, tasksData.social || []);
    taskStore.setTasks(TaskTypes.TASK_TYPES.LIMITED, tasksData.limited || []);
    taskStore.setTasks(TaskTypes.TASK_TYPES.PARTNER, tasksData.partner || []);

    // Розділяємо соціальні та реферальні завдання
    const referralTasks = (tasksData.social || []).filter(
      (task) =>
        (task.tags && Array.isArray(task.tags) && task.tags.includes('referral')) ||
        task.type === 'referral' ||
        (task.title &&
          (task.title.toLowerCase().includes('referral') ||
            task.title.toLowerCase().includes('запроси') ||
            task.title.toLowerCase().includes('запросити')))
    );

    // Зберігаємо реферальні завдання
    if (referralTasks.length > 0) {
      taskStore.setTasks(TaskTypes.TASK_TYPES.REFERRAL, referralTasks);
    }

    // Зберігаємо прогрес, якщо є
    if (tasksData.userProgress) {
      taskStore.setUserProgress(tasksData.userProgress);
    }

    logger.info('Всі типи завдань успішно завантажено', 'loadInitialTasks', {
      social: (tasksData.social || []).length,
      limited: (tasksData.limited || []).length,
      partner: (tasksData.partner || []).length,
      referral: referralTasks.length,
    });

    return true;
  } catch (loadError) {
    logger.warn('Помилка завантаження завдань, продовжуємо ініціалізацію', 'loadInitialTasks', {
      error: loadError,
    });
    return false;
  }
}

/**
 * Ін'єктування посилання на TaskSystem в інші модулі
 * @param {...Object} modules - Модулі для ін'єкції
 */
function injectSystemReference(...modules) {
  const taskSystem = dependencyContainer.resolve('taskSystem');
  if (!taskSystem) return;

  modules.forEach((module) => {
    if (module && typeof module === 'object') {
      module.taskSystem = taskSystem;
    }
  });

  logger.debug("Посилання на TaskSystem ін'єктовано в модулі", 'injectSystemReference');
}

/**
 * Генерація події системи
 * @param {string} eventName - Назва події
 * @param {Object} data - Дані події
 */
function dispatchSystemEvent(eventName, data = {}) {
  if (typeof document === 'undefined') return;

  const event = new CustomEvent(`task-system-${eventName}`, {
    detail: {
      ...data,
      timestamp: Date.now(),
    },
  });

  document.dispatchEvent(event);
  logger.debug(`Згенеровано подію ${eventName}`, 'dispatchSystemEvent', { data });
}

export default initialize;