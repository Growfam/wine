/**
 * Ініціалізатор системи завдань
 *
 * Відповідає за:
 * - Ініціалізацію модулів системи
 * - Координацію процесу завантаження
 */

import { getLogger, LOG_CATEGORIES } from '../../utils';
import dependencyContainer from '../../utils';
import { CONFIG } from '../../config';

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
      conflictResolutionApplied: false
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
      fallbackUserMode: true
    };

    // Залежності між модулями (спрощена схема)
    this.dependencies = {
      'taskProgress': { deps: [], priority: 1 },
      'taskVerification': { deps: [], priority: 1 },
      'taskStore': { deps: ['taskProgress', 'taskVerification'], priority: 2 },
      'taskSystem': { deps: ['taskStore', 'taskProgress', 'taskVerification'], priority: 3 }
    };

    // Критичні модулі
    this.criticalModules = [
      'taskProgress',
      'taskVerification',
      'taskStore',
      'taskSystem'
    ];
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
        logger.info('Ініціалізація вже розпочата', 'init', {
          category: LOG_CATEGORIES.INIT
        });
        return false;
      }

      // Оновлюємо конфігурацію
      Object.assign(this.config, options);

      this.state.initStarted = true;
      this.state.initStartTime = performance.now();

      logger.info('Початок ініціалізації модулів системи завдань', 'init', {
        category: LOG_CATEGORIES.INIT
      });

      // Реєструємо себе як сервіс для інших модулів
      dependencyContainer.register('TaskIntegration', this);

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
      logger.fatal(error, 'Критична помилка при ініціалізації TaskIntegration', {
        category: LOG_CATEGORIES.INIT
      });
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
        'taskProgress', 'taskStore', 'taskVerification', 'taskApi', 'taskSystem'
      ];

      // Для кожного модуля
      for (const moduleName of moduleNames) {
        // Перевіряємо чи не зареєстровано вже
        if (!dependencyContainer.has(moduleName)) {
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
            dependencyContainer.register(moduleName, moduleObj);
            logger.info(`Модуль ${moduleName} автоматично зареєстровано`, 'autoRegisterGlobalModules');
          }
        }
      }
    } catch (error) {
      logger.error(error, 'Помилка автоматичної реєстрації модулів', {
        category: LOG_CATEGORIES.INIT
      });
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
      logger.error(error, 'Помилка при ініціалізації модулів', {
        category: LOG_CATEGORIES.INIT
      });
    }
  }

  /**
   * Отримання відсортованого списку модулів за пріоритетом
   * @returns {Array} Відсортований список модулів
   */
  getSortedModules() {
    try {
      // Створюємо список модулів з пріоритетами
      const modulesList = Object.keys(this.dependencies).map(name => ({
        name,
        priority: this.dependencies[name].priority || 999,
        deps: this.dependencies[name].deps || []
      }));

      // Сортуємо за пріоритетом (нижчий пріоритет = раніше ініціалізується)
      return modulesList
        .sort((a, b) => a.priority - b.priority)
        .map(m => m.name);
    } catch (error) {
      logger.error(error, 'Помилка отримання відсортованого списку модулів', {
        category: LOG_CATEGORIES.LOGIC
      });
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
      const moduleObj = dependencyContainer.resolve(moduleName);

      // Якщо модуля немає, позначаємо як невдалий
      if (!moduleObj) {
        this.state.moduleStates[moduleName] = 'not_found';
        this.state.failedModules.push(moduleName);

        logger.warn(`Модуль ${moduleName} не знайдено`, 'initializeModule', {
          category: LOG_CATEGORIES.INIT
        });

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
        if (initMethod.constructor.name === 'AsyncFunction') {
          await initMethod.call(moduleObj);
        } else {
          initMethod.call(moduleObj);
        }

        this.state.moduleStates[moduleName] = 'ready';

        logger.info(`Модуль ${moduleName} успішно ініціалізовано`, 'initializeModule', {
          category: LOG_CATEGORIES.INIT
        });

        return true;
      } else {
        // Якщо немає методу init, вважаємо що модуль вже ініціалізовано
        this.state.moduleStates[moduleName] = 'ready';
        logger.info(`Модуль ${moduleName} не має методу init, вважаємо його готовим`, 'initializeModule', {
          category: LOG_CATEGORIES.INIT
        });
        return true;
      }
    } catch (error) {
      logger.error(error, `Помилка при ініціалізації модуля ${moduleName}`, {
        category: LOG_CATEGORIES.INIT,
        details: { moduleName }
      });

      this.state.moduleStates[moduleName] = 'failed';
      this.state.failedModules.push(moduleName);

      // Генеруємо подію про помилку
      document.dispatchEvent(new CustomEvent('module-initialization-error', {
        detail: {
          module: moduleName,
          error: error,
          timestamp: Date.now()
        }
      }));

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

      // Для кожної залежності
      deps.forEach(depName => {
        // Отримуємо об'єкт залежності з контейнера
        const depObj = dependencyContainer.resolve(depName);

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
      logger.error(error, `Помилка при ін'єктуванні залежностей для модуля ${moduleName}`, {
        category: LOG_CATEGORIES.LOGIC,
        details: { moduleName }
      });
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
        m => this.state.moduleStates[m] === 'ready' || this.state.moduleStates[m] === 'not_found'
      );

      // Фіксуємо час завершення
      this.state.initEndTime = performance.now();
      const initDuration = this.state.initEndTime - this.state.initStartTime;

      this.state.initialized = true;

      // Відправляємо подію про успішну ініціалізацію
      if (allCriticalReady) {
        logger.info(`Всі критичні модулі успішно ініціалізовано за ${Math.round(initDuration)}мс`, 'finalizeInitialization', {
          category: LOG_CATEGORIES.INIT,
          details: {
            initDuration: Math.round(initDuration),
            moduleStates: { ...this.state.moduleStates }
          }
        });

        // Виправляємо проблеми з отриманням ID користувача у всіх модулях
        this.fixUserIdIssues();

        // Відправляємо подію про успішну ініціалізацію
        document.dispatchEvent(new CustomEvent('task-system-initialized', {
          detail: {
            modules: Object.keys(this.state.moduleStates).filter(m => this.state.moduleStates[m] === 'ready'),
            initTime: Math.round(initDuration),
            timestamp: Date.now()
          }
        }));
      } else {
        // Якщо є невдалі критичні модулі, спробуємо їх відновити
        const failedCritical = this.criticalModules.filter(m => this.state.moduleStates[m] === 'failed');

        if (failedCritical.length > 0) {
          logger.error(`Не вдалося ініціалізувати критичні модулі: ${failedCritical.join(', ')}`, 'finalizeInitialization', {
            category: LOG_CATEGORIES.INIT,
            details: { failedModules: failedCritical }
          });

          // В автоматичному режимі спробуємо відновити
          if (this.config.autoRetryOnFailure) {
            logger.info('Спроба відновлення невдалих модулів...', 'finalizeInitialization');
            this.recoverFailedModules();
          }
        }

        // Відправляємо подію про часткову ініціалізацію
        document.dispatchEvent(new CustomEvent('task-system-partial-init', {
          detail: {
            modules: Object.keys(this.state.moduleStates).filter(m => this.state.moduleStates[m] === 'ready'),
            failed: Object.keys(this.state.moduleStates).filter(m => this.state.moduleStates[m] === 'failed'),
            notFound: Object.keys(this.state.moduleStates).filter(m => this.state.moduleStates[m] === 'not_found'),
            initTime: Math.round(initDuration),
            timestamp: Date.now()
          }
        }));
      }
    } catch (error) {
      logger.fatal(error, 'Критична помилка завершення ініціалізації', {
        category: LOG_CATEGORIES.INIT
      });
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
      logger.error(error, 'Помилка скидання стану інтеграції', {
        category: LOG_CATEGORIES.LOGIC
      });
      return false;
    }
  }
}