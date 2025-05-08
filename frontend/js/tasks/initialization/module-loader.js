/**
 * Завантажувач модулів системи завдань
 *
 * Відповідає за:
 * - Асинхронне завантаження всіх необхідних модулів
 * - Кешування модулів для повторного використання
 *
 * @version 3.1.0
 */

import { getLogger } from '../utils/core/logger.js';
import taskApiFactory from '../api/index.js';

// Створюємо логер для завантажувача модулів
const logger = getLogger('ModuleLoader');

// Кеш завантажених модулів
const moduleCache = {
  models: null,
  api: null,
  services: null,
  ui: null,
};

/**
 * Асинхронне завантаження всіх необхідних модулів
 * @returns {Promise<Object>} Об'єкт з завантаженими модулями
 */
export async function loadModules() {
  try {
    logger.info('Початок завантаження модулів', 'loadModules');

    // Якщо модулі вже в кеші, повертаємо їх
    if (moduleCache.models && moduleCache.services) {
      logger.info('Використання кешованих модулів', 'loadModules');
      return moduleCache;
    }

    // Завантажуємо всі необхідні модулі паралельно з використанням динамічних імпортів
    const [modelsModule, servicesModule, uiModule] = await Promise.all([
      import('../models/index.js'),
      import('../services/index.js'),
      import('../ui/index.js'),
    ]);

    // Зберігаємо модулі в кеш
    moduleCache.models = modelsModule;
    moduleCache.services = servicesModule;
    moduleCache.ui = uiModule;

    // Ініціалізуємо API (створюємо один раз)
    if (!moduleCache.api) {
      moduleCache.api = taskApiFactory;
      moduleCache.api.init();
    }

    logger.info('Всі модулі успішно завантажено', 'loadModules');
    return moduleCache;
  } catch (error) {
    logger.error('Помилка завантаження модулів', 'loadModules', { error });
    throw error;
  }
}

/**
 * Отримання раніше завантажених модулів
 * @returns {Object} Кеш модулів
 */
export function getModuleCache() {
  return moduleCache;
}

/**
 * Перевірка, чи всі необхідні модулі завантажені
 * @returns {boolean} Результат перевірки
 */
export function areModulesLoaded() {
  return !!(moduleCache.models && moduleCache.services && moduleCache.api);
}

/**
 * Очищення кешу модулів
 */
export function clearModuleCache() {
  moduleCache.models = null;
  moduleCache.services = null;
  moduleCache.ui = null;
  // Не очищуємо API, оскільки він має власний стан
  logger.info('Кеш модулів очищено', 'clearModuleCache');
}

export default {
  loadModules,
  getModuleCache,
  areModulesLoaded,
  clearModuleCache
};