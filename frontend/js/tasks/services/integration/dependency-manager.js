/**
 * Менеджер залежностей для системи завдань
 *
 * Відповідає за:
 * - Реєстрацію модулів в контейнері
 * - Отримання модулів з контейнера
 * - Управління залежностями між модулями
 */

import { getLogger, LOG_CATEGORIES } from '../../utils';
import dependencyContainer from '../../utils';

// Створюємо логер для модуля
const logger = getLogger('DependencyManager');

export class DependencyManager {
  constructor() {
    // Залежності між модулями (спрощена схема)
    this.dependencies = {
      taskProgress: { deps: [], priority: 1 },
      taskVerification: { deps: [], priority: 1 },
      taskStore: { deps: ['taskProgress', 'taskVerification'], priority: 2 },
      taskSystem: { deps: ['taskStore', 'taskProgress', 'taskVerification'], priority: 3 },
    };
  }

  /**
   * Реєстрація модуля в контейнері залежностей
   * @param {string} moduleName - Назва модуля
   * @param {Object} moduleInstance - Екземпляр модуля
   */
  register(moduleName, moduleInstance) {
    dependencyContainer.register(moduleName, moduleInstance);
    logger.info(`Модуль ${moduleName} зареєстровано в контейнері залежностей`, 'register');
    return this;
  }

  /**
   * Отримання модуля з контейнера залежностей
   * @param {string} moduleName - Назва модуля
   * @returns {Object|null} - Екземпляр модуля або null
   */
  getModule(moduleName) {
    return dependencyContainer.resolve(moduleName);
  }

  /**
   * Отримання списку зареєстрованих модулів
   * @returns {Array} Список модулів
   */
  getRegisteredModules() {
    return dependencyContainer.getRegisteredModules();
  }

  /**
   * Перевірка, чи зареєстровано модуль
   * @param {string} moduleName - Назва модуля
   * @returns {boolean} Результат перевірки
   */
  hasModule(moduleName) {
    return dependencyContainer.has(moduleName);
  }

  /**
   * Видалення модуля з контейнера
   * @param {string} moduleName - Назва модуля
   * @returns {boolean} Результат видалення
   */
  unregister(moduleName) {
    if (dependencyContainer.has(moduleName)) {
      dependencyContainer.remove(moduleName);
      logger.info(`Модуль ${moduleName} видалено з контейнера залежностей`, 'unregister');
      return true;
    }
    return false;
  }

  /**
   * Ін'єктування залежностей в модуль
   * @param {Object} moduleObj - Об'єкт модуля
   * @param {string} moduleName - Назва модуля
   */
  injectDependencies(moduleObj, moduleName) {
    try {
      // Отримуємо список залежностей
      const deps = this.dependencies[moduleName]?.deps || [];

      // Якщо немає залежностей, виходимо
      if (deps.length === 0) return;

      // Для кожної залежності
      deps.forEach((depName) => {
        // Отримуємо об'єкт залежності з контейнера
        const depObj = dependencyContainer.resolve(depName);

        // Якщо залежність знайдено
        if (depObj) {
          // Назва властивості з маленької літери для camelCase
          const propName = depName.charAt(0).toLowerCase() + depName.slice(1);

          // Встановлюємо залежність в об'єкт модуля
          if (typeof moduleObj === 'object' && !moduleObj[propName]) {
            moduleObj[propName] = depObj;
            logger.info(
              `Ін'єктовано залежність ${depName} в модуль ${moduleName} як ${propName}`,
              'injectDependencies'
            );
          }
        }
      });
    } catch (error) {
      logger.error(error, `Помилка при ін'єктуванні залежностей для модуля ${moduleName}`, {
        category: LOG_CATEGORIES.LOGIC,
        details: { moduleName },
      });
    }
  }

  /**
   * Встановлення залежностей для модуля
   * @param {string} moduleName - Назва модуля
   * @param {Array} deps - Масив залежностей
   * @param {number} priority - Пріоритет модуля
   */
  setDependencies(moduleName, deps = [], priority = 999) {
    if (!this.dependencies[moduleName]) {
      this.dependencies[moduleName] = { deps: [], priority: 999 };
    }

    this.dependencies[moduleName].deps = deps;
    this.dependencies[moduleName].priority = priority;

    logger.info(`Встановлено залежності для модуля ${moduleName}`, 'setDependencies', {
      details: { moduleName, deps, priority },
    });
  }

  /**
   * Отримання залежностей модуля
   * @param {string} moduleName - Назва модуля
   * @returns {Array} Масив залежностей
   */
  getDependencies(moduleName) {
    return this.dependencies[moduleName]?.deps || [];
  }

  /**
   * Очищення контейнера залежностей
   */
  clear() {
    dependencyContainer.clear();
    logger.info('Контейнер залежностей очищено', 'clear');
  }
}
