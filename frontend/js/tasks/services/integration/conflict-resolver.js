/**
 * Вирішувач конфліктів між модулями
 *
 * Відповідає за:
 * - Виявлення та вирішення конфліктів між модулями
 * - Делегування функціональності між модулями
 */

import { getLogger, LOG_CATEGORIES,  } from '../../utils/core/logger.js';
import { dependencyContainer } from '../../utils/core/dependency.js';

// Створюємо логер для модуля
const logger = getLogger('ConflictResolver');

export class ConflictResolver {
  constructor() {
    // Прапорець застосування вирішення конфліктів
    this.conflictResolutionApplied = false;
  }

  /**
   * Вирішення конфліктів між модулями
   * @returns {Promise<void>}
   */
  async resolveModuleConflicts() {
    if (this.conflictResolutionApplied) return;

    try {
      logger.info('Вирішення конфліктів між модулями...', 'resolveModuleConflicts');

      // Отримуємо модулі з контейнера залежностей
      const taskSystem = dependencyContainer.resolve('taskSystem');
      const taskProgress = dependencyContainer.resolve('taskProgress');
      const taskVerification = dependencyContainer.resolve('taskVerification');
      const taskStore = dependencyContainer.resolve('taskStore');

      // Синхронізуємо TaskSystem з TaskProgress
      if (taskSystem && taskProgress) {
        // Якщо потрібно, делегуємо методи прогресу
        if (!taskSystem.getTaskProgress) {
          taskSystem.getTaskProgress = taskProgress.getTaskProgress.bind(taskProgress);
        }

        if (!taskSystem.updateTaskProgress) {
          taskSystem.updateTaskProgress = taskProgress.updateTaskProgress.bind(taskProgress);
        }

        logger.info('Налаштовано делегування методів прогресу', 'resolveModuleConflicts');
      }

      // Синхронізуємо TaskSystem з TaskVerification
      if (taskSystem && taskVerification) {
        if (!taskSystem.verifyTask) {
          taskSystem.verifyTask = taskVerification.verifyTask.bind(taskVerification);
        }

        logger.info('Налаштовано делегування методів верифікації', 'resolveModuleConflicts');
      }

      // Для зворотньої сумісності
      if (window.TaskManager) {
        // Оновлюємо методи в TaskManager
        if (taskProgress) {
          window.TaskManager.getTaskProgress = taskProgress.getTaskProgress.bind(taskProgress);
          window.TaskManager.updateTaskProgress =
            taskProgress.updateTaskProgress.bind(taskProgress);
        }

        if (taskVerification) {
          window.TaskManager.verifyTask = taskVerification.verifyTask.bind(taskVerification);
        }

        // Реєструємо TaskManager в контейнері
        dependencyContainer.register('TaskManager', window.TaskManager);
      }

      this.conflictResolutionApplied = true;
    } catch (error) {
      logger.error(error, 'Помилка при вирішенні конфліктів між модулями', {
        category: LOG_CATEGORIES.LOGIC,
      });
    }
  }

  /**
   * Вирішення конфліктів для конкретного модуля
   * @param {string} moduleName - Назва модуля
   * @returns {Promise<boolean>} Результат вирішення конфліктів
   */
  async resolveConflictsForModule(moduleName) {
    try {
      logger.info(`Вирішення конфліктів для модуля ${moduleName}...`, 'resolveConflictsForModule');

      // Отримуємо модуль
      const module = dependencyContainer.resolve(moduleName);
      if (!module) {
        logger.warn(`Модуль ${moduleName} не знайдено`, 'resolveConflictsForModule');
        return false;
      }

      // В залежності від типу модуля виконуємо різні дії
      switch (moduleName) {
        case 'taskProgress':
          await this.resolveTaskProgressConflicts(module);
          break;

        case 'taskVerification':
          await this.resolveTaskVerificationConflicts(module);
          break;

        case 'taskStore':
          await this.resolveTaskStoreConflicts(module);
          break;

        case 'taskSystem':
          await this.resolveTaskSystemConflicts(module);
          break;

        default:
          // Для інших модулів не потрібно спеціальних дій
          logger.info(
            `Немає спеціальних дій для модуля ${moduleName}`,
            'resolveConflictsForModule'
          );
          return true;
      }

      return true;
    } catch (error) {
      logger.error(error, `Помилка при вирішенні конфліктів для модуля ${moduleName}`, {
        category: LOG_CATEGORIES.LOGIC,
        details: { moduleName },
      });
      return false;
    }
  }

  /**
   * Вирішення конфліктів для модуля TaskProgress
   * @param {Object} progressModule - Модуль TaskProgress
   */
  async resolveTaskProgressConflicts(progressModule) {
    // Тут можна додати специфічні дії для TaskProgress

    // Для прикладу, синхронізуємо з іншими модулями, які можуть мати подібну функціональність
    const taskSystem = dependencyContainer.resolve('taskSystem');
    if (taskSystem && taskSystem.updateProgress && !progressModule.legacyUpdateProgress) {
      progressModule.legacyUpdateProgress = taskSystem.updateProgress.bind(taskSystem);
      logger.info(
        'Додано метод legacyUpdateProgress до TaskProgress',
        'resolveTaskProgressConflicts'
      );
    }
  }

  /**
   * Вирішення конфліктів для модуля TaskVerification
   * @param {Object} verificationModule - Модуль TaskVerification
   */
  async resolveTaskVerificationConflicts(verificationModule) {
    // Тут можна додати специфічні дії для TaskVerification

    // Наприклад, переконуємося, що всі необхідні верифікатори зареєстровані
    if (typeof verificationModule.registerVerifier === 'function') {
      // Перевіряємо наявність генеричного верифікатора
      if (!verificationModule.verifiers?.generic) {
        const genericVerifier = dependencyContainer.resolve('genericVerifier');
        if (genericVerifier) {
          verificationModule.registerVerifier('generic', genericVerifier);
          logger.info(
            'Зареєстровано genericVerifier в TaskVerification',
            'resolveTaskVerificationConflicts'
          );
        }
      }
    }
  }

  /**
   * Вирішення конфліктів для модуля TaskStore
   * @param {Object} storeModule - Модуль TaskStore
   */
  async resolveTaskStoreConflicts(storeModule) {
    // Тут можна додати специфічні дії для TaskStore

    // Перевіряємо наявність кеш-сервісу
    if (!window.cacheService) {
      logger.warn(
        'Не знайдено cacheService, використовуємо локальний кеш для TaskStore',
        'resolveTaskStoreConflicts'
      );

      // Можна додати простий кеш для сумісності
      window.cacheService = {
        get: (key, defaultValue = null) => {
          try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
          } catch (error) {
            return defaultValue;
          }
        },
        set: (key, value, options = {}) => {
          try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
          } catch (error) {
            return false;
          }
        },
        remove: (key) => {
          try {
            localStorage.removeItem(key);
            return true;
          } catch (error) {
            return false;
          }
        },
        removeByTags: () => true, // Заглушка для сумісності
      };
    }
  }

  /**
   * Вирішення конфліктів для модуля TaskSystem
   * @param {Object} systemModule - Модуль TaskSystem
   */
  async resolveTaskSystemConflicts(systemModule) {
    // Тут можна додати специфічні дії для TaskSystem

    // Для зворотної сумісності зі старою системою
    if (window.TaskManager && window.TaskManager !== systemModule) {
      // Перенаправляємо деякі методи
      const methods = ['initialize', 'getTaskProgress', 'updateTaskProgress', 'verifyTask'];

      methods.forEach((method) => {
        if (
          typeof systemModule[method] === 'function' &&
          typeof window.TaskManager[method] !== 'function'
        ) {
          window.TaskManager[method] = systemModule[method].bind(systemModule);
          logger.info(
            `Метод ${method} додано до TaskManager для сумісності`,
            'resolveTaskSystemConflicts'
          );
        }
      });
    }
  }
}
