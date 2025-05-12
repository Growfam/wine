/**
 * Ініціалізатор системи завдань
 *
 * Відповідає за:
 * - Ініціалізацію модулів системи
 * - Координацію процесу завантаження
 */

import { getLogger } from '../utils/core/logger.js';

// Створюємо логер для модуля
const logger = getLogger('TaskIntegration');

export class Initializer {
  constructor() {
    // Стан модуля
    this.state = {
      initialized: false,
      initStarted: false,
      moduleStates: {},
      failedModules: [],
      initStartTime: 0,
      initEndTime: 0,
      conflictResolutionApplied: false,
    };

    // Конфігурація
    this.config = {
      enableLogging: true,
      maxInitAttempts: 3,
      initTimeout: 15000,
      autoResolveConflicts: true,
      safeMode: true,
      autoRetryOnFailure: true,
      monitorDomMutations: true,
      fallbackUserMode: true,
    };

    // Залежності між модулями (спрощена схема)
    this.dependencies = {
      taskProgress: { deps: [], priority: 1 },
      taskVerification: { deps: [], priority: 1 },
      taskStore: { deps: ['taskProgress', 'taskVerification'], priority: 2 },
      taskSystem: { deps: ['taskStore', 'taskProgress', 'taskVerification'], priority: 3 },
    };

    // Критичні модулі
    this.criticalModules = ['taskProgress', 'taskVerification', 'taskStore', 'taskSystem'];
  }

  /**
   * Асинхронна ініціалізація сервісу
   * @param {Object} options - Опції ініціалізації
   * @returns {Promise<boolean>} Результат ініціалізації
   */
  async init(options = {}) {
    try {
      // Якщо ініціалізація вже почалася, не запускаємо знову
      if (this.state.initStarted) {
        logger.info('Ініціалізація вже розпочата', 'init');
        return false;
      }

      // Оновлюємо конфігурацію
      Object.assign(this.config, options);

      this.state.initStarted = true;
      this.state.initStartTime = performance.now();

      logger.info('Початок ініціалізації модулів системи завдань', 'init');

      // Реєструємо себе як сервіс для інших модулів
      if (window.dependencyContainer) {
        window.dependencyContainer.register('TaskIntegration', this);
      }

      // Автоматична реєстрація модулів з глобального скопу
      await this.autoRegisterGlobalModules();

      // Ініціалізація модулів у правильному порядку
      await this.initModulesInOrder();

      // Застосування вирішення конфліктів, якщо потрібно
      if (this.config.autoResolveConflicts) {
        await this.resolveModuleConflicts();
      }

      // Встановлюємо таймаут для перевірки стану ініціалізації
      setTimeout(() => this.finalizeInitialization(), 500);

      return true;
    } catch (error) {
      logger.error('Критична помилка при ініціалізації TaskIntegration', error);
      return false;
    }
  }

  /**
   * Асинхронна автоматична реєстрація модулів з глобального скопу
   * @returns {Promise<void>}
   */
  async autoRegisterGlobalModules() {
    logger.info('Автоматична реєстрація модулів...', 'autoRegisterGlobalModules');

    try {
      // Список можливих назв модулів для автореєстрації
      const moduleNames = [
        'taskProgress',
        'taskStore',
        'taskVerification',
        'taskApi',
        'taskSystem',
      ];

      const container = window.dependencyContainer;
      if (!container) {
        logger.warn('Не знайдено dependencyContainer для реєстрації модулів');
        return;
      }

      // Для кожного модуля
      for (const moduleName of moduleNames) {
        // Перевіряємо чи не зареєстровано вже
        if (!container.has(moduleName)) {
          // Шукаємо в глобальному об'єкті
          let moduleObj = window[moduleName];

          // Шукаємо переформатоване ім'я (перша літера вєлика)
          if (!moduleObj) {
            const capitalizedName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
            moduleObj = window[capitalizedName];
          }

          // Шукаємо альтернативні назви
          if (!moduleObj) {
            if (moduleName === 'taskSystem' && window.TaskManager) {
              moduleObj = window.TaskManager;
            }
          }

          // Якщо знайдено
          if (moduleObj) {
            container.register(moduleName, moduleObj);
            logger.info(`Модуль ${moduleName} автоматично зареєстровано`, 'autoRegisterGlobalModules');
          }
        }
      }
    } catch (error) {
      logger.error('Помилка автоматичної реєстрації модулів', error);
    }
  }

  /**
   * Асинхронна ініціалізація модулів у правильному порядку
   * @returns {Promise<void>}
   */
  async initModulesInOrder() {
    logger.info('Початок ініціалізації модулів у пріоритетному порядку', 'initModulesInOrder');

    try {
      // Отримуємо список модулів, відсортований за пріоритетом
      const modulesToInit = this.getSortedModules();

      // Почергово ініціалізуємо модулі
      for (const moduleName of modulesToInit) {
        await this.initializeModule(moduleName);
      }
    } catch (error) {
      logger.error('Помилка при ініціалізації модулів', error);
    }
  }

  /**
   * Отримання відсортованого списку модулів за пріоритетом
   * @returns {Array} Відсортований список модулів
   */
  getSortedModules() {
    try {
      // Створюємо список модулів з пріоритетами
      const modulesList = Object.keys(this.dependencies).map((name) => ({
        name,
        priority: this.dependencies[name].priority || 999,
        deps: this.dependencies[name].deps || [],
      }));

      // Сортуємо за пріоритетом (нижчий пріоритет = раніше ініціалізується)
      return modulesList.sort((a, b) => a.priority - b.priority).map((m) => m.name);
    } catch (error) {
      logger.error('Помилка отримання відсортованого списку модулів', error);
      return [];
    }
  }

  /**
   * Асинхронна ініціалізація конкретного модуля
   * @param {string} moduleName - Назва модуля
   * @returns {Promise<boolean>} Результат ініціалізації
   */
  async initializeModule(moduleName) {
    try {
      // Якщо модуль вже ініціалізовано, пропускаємо
      if (this.state.moduleStates[moduleName] === 'ready') {
        return true;
      }

      // Відзначаємо, що ініціалізація почалася
      this.state.moduleStates[moduleName] = 'initializing';

      // Отримуємо посилання на модуль з контейнера залежностей
      const moduleObj = window.dependencyContainer ?
        window.dependencyContainer.resolve(moduleName) : null;

      // Якщо модуля немає, позначаємо як невдалий
      if (!moduleObj) {
        this.state.moduleStates[moduleName] = 'not_found';
        this.state.failedModules.push(moduleName);

        logger.warn(`Модуль ${moduleName} не знайдено`, 'initializeModule');
        return false;
      }

      // Перевіряємо залежності
      const deps = this.dependencies[moduleName]?.deps || [];

      // Першами ініціалізуємо залежності
      for (const depName of deps) {
        if (this.state.moduleStates[depName] !== 'ready') {
          await this.initializeModule(depName);
        }
      }

      // Ін'єктуємо залежності перед ініціалізацією
      this.injectDependencies(moduleObj, moduleName);

      // Якщо у модуля є метод init або initialize, викликаємо його
      if (typeof moduleObj.init === 'function' || typeof moduleObj.initialize === 'function') {
        const initMethod = moduleObj.init || moduleObj.initialize;

        // Перевіряємо, чи метод асинхронний
        try {
          if (initMethod.constructor.name === 'AsyncFunction') {
            await initMethod.call(moduleObj);
          } else {
            initMethod.call(moduleObj);
          }

          this.state.moduleStates[moduleName] = 'ready';
          logger.info(`Модуль ${moduleName} успішно ініціалізовано`, 'initializeModule');
          return true;
        } catch (initError) {
          logger.error(`Помилка ініціалізації модуля ${moduleName}: ${initError.message}`, initError);
          this.state.moduleStates[moduleName] = 'failed';
          this.state.failedModules.push(moduleName);
          return false;
        }
      } else {
        // Якщо немає методу init, вважаємо що модуль вже ініціалізовано
        this.state.moduleStates[moduleName] = 'ready';
        logger.info(`Модуль ${moduleName} не має методу init, вважаємо його готовим`, 'initializeModule');
        return true;
      }
    } catch (error) {
      logger.error(`Помилка при ініціалізації модуля ${moduleName}`, error);

      this.state.moduleStates[moduleName] = 'failed';
      this.state.failedModules.push(moduleName);

      // Генеруємо подію про помилку
      document.dispatchEvent(
        new CustomEvent('module-initialization-error', {
          detail: {
            module: moduleName,
            error: error,
            timestamp: Date.now(),
          },
        })
      );

      return false;
    }
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

      const container = window.dependencyContainer;
      if (!container) {
        logger.warn('Не знайдено dependencyContainer для ін\'єктування залежностей');
        return;
      }

      // Для кожної залежності
      deps.forEach((depName) => {
        // Отримуємо об'єкт залежності з контейнера
        const depObj = container.resolve(depName);

        // Якщо залежність знайдено
        if (depObj) {
          // Назва властивості з маленької літери для camelCase
          const propName = depName.charAt(0).toLowerCase() + depName.slice(1);

          // Встановлюємо залежність в об'єкт модуля
          if (typeof moduleObj === 'object' && !moduleObj[propName]) {
            moduleObj[propName] = depObj;
            logger.info(`Ін'єктовано залежність ${depName} в модуль ${moduleName} як ${propName}`, 'injectDependencies');
          }
        }
      });
    } catch (error) {
      logger.error(`Помилка при ін'єктуванні залежностей для модуля ${moduleName}`, error);
    }
  }

  /**
   * Вирішення конфліктів між модулями
   * @returns {Promise<void>}
   */
  async resolveModuleConflicts() {
    if (this.state.conflictResolutionApplied) return;

    try {
      logger.info('Вирішення конфліктів між модулями...', 'resolveModuleConflicts');

      // Отримуємо модулі з контейнера залежностей
      const container = window.dependencyContainer;
      if (!container) {
        logger.warn('Не знайдено dependencyContainer для вирішення конфліктів');
        return;
      }

      const taskSystem = container.resolve('taskSystem');
      const taskProgress = container.resolve('taskProgress');
      const taskVerification = container.resolve('taskVerification');
      const taskStore = container.resolve('taskStore');

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
          window.TaskManager.updateTaskProgress = taskProgress.updateTaskProgress.bind(taskProgress);
        }

        if (taskVerification) {
          window.TaskManager.verifyTask = taskVerification.verifyTask.bind(taskVerification);
        }

        // Реєструємо TaskManager в контейнері
        container.register('TaskManager', window.TaskManager);
      }

      this.state.conflictResolutionApplied = true;
    } catch (error) {
      logger.error('Помилка при вирішенні конфліктів між модулями', error);
    }
  }

  /**
   * Завершення процесу ініціалізації
   */
  finalizeInitialization() {
    try {
      // Якщо вже ініціалізовано, не виконуємо повторно
      if (this.state.initialized) return;

      // Визначаємо успішність ініціалізації
      const allCriticalReady = this.criticalModules.every(
        (m) => this.state.moduleStates[m] === 'ready' || this.state.moduleStates[m] === 'not_found'
      );

      // Фіксуємо час завершення
      this.state.initEndTime = performance.now();
      const initDuration = this.state.initEndTime - this.state.initStartTime;

      this.state.initialized = true;

      // Відправляємо подію про успішну ініціалізацію
      if (allCriticalReady) {
        logger.info(
          `Всі критичні модулі успішно ініціалізовано за ${Math.round(initDuration)}мс`,
          'finalizeInitialization'
        );

        // Виправляємо проблеми з отриманням ID користувача у всіх модулях
        this.fixUserIdIssues();

        // Відправляємо подію про успішну ініціалізацію
        document.dispatchEvent(
          new CustomEvent('task-system-initialized', {
            detail: {
              modules: Object.keys(this.state.moduleStates).filter(
                (m) => this.state.moduleStates[m] === 'ready'
              ),
              initTime: Math.round(initDuration),
              timestamp: Date.now(),
            },
          })
        );
      } else {
        // Якщо є невдалі критичні модулі, спробуємо їх відновити
        const failedCritical = this.criticalModules.filter(
          (m) => this.state.moduleStates[m] === 'failed'
        );

        if (failedCritical.length > 0) {
          logger.error(
            `Не вдалося ініціалізувати критичні модулі: ${failedCritical.join(', ')}`,
            'finalizeInitialization'
          );

          // В автоматичному режимі спробуємо відновити
          if (this.config.autoRetryOnFailure) {
            logger.info('Спроба відновлення невдалих модулів...', 'finalizeInitialization');
            this.recoverFailedModules();
          }
        }

        // Відправляємо подію про часткову ініціалізацію
        document.dispatchEvent(
          new CustomEvent('task-system-partial-init', {
            detail: {
              modules: Object.keys(this.state.moduleStates).filter(
                (m) => this.state.moduleStates[m] === 'ready'
              ),
              failed: Object.keys(this.state.moduleStates).filter(
                (m) => this.state.moduleStates[m] === 'failed'
              ),
              notFound: Object.keys(this.state.moduleStates).filter(
                (m) => this.state.moduleStates[m] === 'not_found'
              ),
              initTime: Math.round(initDuration),
              timestamp: Date.now(),
            },
          })
        );
      }
    } catch (error) {
      logger.error('Критична помилка завершення ініціалізації', error);
    }
  }

  /**
   * Відновлення невдалих модулів
   * @returns {Promise<Object>} Результат відновлення
   */
  async recoverFailedModules() {
    try {
      // Отримуємо список невдалих критичних модулів
      const failedCritical = this.criticalModules.filter(
        (m) => this.state.moduleStates[m] === 'failed'
      );

      if (failedCritical.length === 0) {
        logger.info('Немає невдалих критичних модулів для відновлення', 'recoverFailedModules');
        return {
          success: true,
          message: 'Немає невдалих модулів для відновлення',
          timestamp: Date.now(),
        };
      }

      logger.info(
        `Спроба відновлення модулів: ${failedCritical.join(', ')}`,
        'recoverFailedModules'
      );

      // Результати відновлення
      const results = {};

      // Спробуємо ще раз ініціалізувати кожен модуль
      for (const moduleName of failedCritical) {
        try {
          // Скидаємо стан модуля
          this.state.moduleStates[moduleName] = 'pending';

          // Видаляємо з списку невдалих
          const index = this.state.failedModules.indexOf(moduleName);
          if (index > -1) {
            this.state.failedModules.splice(index, 1);
          }

          // Спробуємо ініціалізувати знову
          const success = await this.initializeModule(moduleName);

          results[moduleName] = {
            success
          };

          logger.info(
            `${success ? 'Успішно відновлено' : 'Не вдалося відновити'} модуль ${moduleName}`,
            'recoverFailedModules'
          );
        } catch (moduleError) {
          logger.error(`Помилка при спробі відновлення модуля ${moduleName}`, moduleError);

          results[moduleName] = {
            success: false,
            error: moduleError.message
          };
        }
      }

      // Перевіряємо загальний результат
      const allSucceeded = Object.values(results).every((r) => r.success);

      return {
        success: allSucceeded,
        message: allSucceeded
          ? 'Всі модулі успішно відновлено'
          : 'Не вдалося відновити деякі модулі',
        results,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Помилка при відновленні невдалих модулів', error);

      return {
        success: false,
        message: 'Помилка при відновленні модулів',
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Виправлення проблем з ID користувача у всіх модулях
   */
  fixUserIdIssues() {
    try {
      // Створення userId-провайдера та реєстрація в контейнері залежностей
      const userIdProvider = {
        getUserId: () => {
          // Тут має бути логіка отримання ID користувача
          // Спрощений варіант:
          try {
            // Спочатку перевіряємо глобальну функцію
            if (typeof window.getUserId === 'function') {
              const userId = window.getUserId();
              if (userId) return userId;
            }

            // Потім перевіряємо localStorage
            if (window.localStorage) {
              const storedId = window.localStorage.getItem('telegram_user_id');
              if (storedId && storedId !== 'undefined' && storedId !== 'null') {
                return storedId;
              }
            }

            // Перевіряємо URL параметри
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            if (urlId) return urlId;

            // Якщо нічого не знайдено і включений fallback
            if (this.config.fallbackUserMode) {
              logger.info('Повертаємо тимчасовий ID для режиму fallback', 'getUserId');
              return 'temp_user_' + Math.random().toString(36).substring(2, 9);
            }

            return null;
          } catch (error) {
            logger.error('Помилка отримання ID користувача', error);
            return null;
          }
        },
      };

      if (window.dependencyContainer) {
        window.dependencyContainer.register('UserIdProvider', userIdProvider);
      }

      // Перевіряємо, чи є функція getUserId
      if (typeof window.getUserId !== 'function') {
        logger.info('Створення глобальної функції getUserId...', 'fixUserIdIssues');

        // Створюємо функцію getUserId, яка використовує зареєстрований провайдер
        window.getUserId = userIdProvider.getUserId;
      }
    } catch (error) {
      logger.error('Помилка при виправленні проблем з ID користувача', error);
    }
  }

  /**
   * Скидання стану інтеграції для повторної ініціалізації
   */
  reset() {
    try {
      // Скидаємо основні прапорці стану
      this.state.initialized = false;
      this.state.initStarted = false;
      this.state.failedModules = [];
      this.state.moduleStates = {};
      this.state.initStartTime = 0;
      this.state.initEndTime = 0;
      this.state.conflictResolutionApplied = false;

      logger.info('Стан інтеграції скинуто', 'reset');

      return true;
    } catch (error) {
      logger.error('Помилка скидання стану інтеграції', error);
      return false;
    }
  }
}

export default Initializer;