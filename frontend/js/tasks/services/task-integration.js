/**
 * Сервіс інтеграції системи завдань
 *
 * Відповідає за:
 * - Координацію ініціалізації всіх модулів
 * - Виявлення та вирішення конфліктів
 * - Відновлення при помилках
 * - Діагностику системи
 */

import { CONFIG } from '../config/task-types.js';
import { getLogger, LOG_CATEGORIES } from '../utils/logger.js';
import { DependencyContainer } from '../utils/dependency-container.js';

// Створюємо логер для модуля
const logger = getLogger('TaskIntegration');

// Для зворотньої сумісності створюємо модульний обробник
const moduleErrors = logger.createModuleHandler('TaskIntegration');

class TaskIntegration {
  constructor() {
    // Ініціалізація контейнера залежностей
    this.dependencyContainer = new DependencyContainer();

    // Стан модуля
    this.state = {
      initialized: false,
      initStarted: false,
      moduleStates: {},
      failedModules: [],
      initializationTimestamps: {},
      lastError: null,
      initStartTime: 0,
      initEndTime: 0,
      conflictResolutionApplied: false
    };

    // Конфігурація
    this.config = {
      enableLogging: true,
      detailedLogging: true,
      maxInitAttempts: 3,
      initTimeout: 15000,
      autoResolveConflicts: true,
      safeMode: true,
      autoRetryOnFailure: true,
      monitorDomMutations: true,
      fallbackUserMode: true
    };

    // Залежності між модулями
    this.dependencies = {
      'UI.Animations': { deps: ['StorageUtils', 'TimeUtils'], priority: 1 },
      'UI.Notifications': { deps: [], priority: 1 },
      'UI.ProgressBar': { deps: [], priority: 1 },
      'TaskProgress': { deps: ['UI.Animations', 'UI.Notifications', 'UI.ProgressBar'], priority: 2 },
      'TaskVerification': { deps: [], priority: 2 },
      'TaskStore': { deps: ['TaskProgress', 'TaskVerification'], priority: 3 },
      'TaskSystem': { deps: ['TaskStore', 'TaskProgress', 'TaskVerification'], priority: 4 }
    };

    // Критичні модулі
    this.criticalModules = [
      'TaskProgress',
      'TaskVerification',
      'TaskStore',
      'TaskSystem'
    ];

    // DOM Observer для динамічних елементів
    this.domObserver = null;
  }

  /**
   * Реєстрація модуля в контейнері залежностей
   * @param {string} moduleName - Назва модуля
   * @param {Object} moduleInstance - Екземпляр модуля
   */
  registerModule(moduleName, moduleInstance) {
    this.dependencyContainer.register(moduleName, moduleInstance);
    logger.info(`Модуль ${moduleName} зареєстровано в контейнері залежностей`, 'registerModule');
    return this;
  }

  /**
   * Отримання модуля з контейнера залежностей
   * @param {string} moduleName - Назва модуля
   * @returns {Object|null} - Екземпляр модуля або null
   */
  getModule(moduleName) {
    return this.dependencyContainer.resolve(moduleName);
  }

  /**
   * Ініціалізація сервісу інтеграції
   * @param {Object} options - Налаштування
   */
  init(options = {}) {
    try {
      // Якщо ініціалізація вже почалася, не запускаємо знову
      if (this.state.initStarted) {
        logger.info('Ініціалізація вже розпочата', 'init', {
          category: LOG_CATEGORIES.INIT
        });
        return;
      }

      // Оновлюємо конфігурацію
      Object.assign(this.config, options);

      this.state.initStarted = true;
      this.state.initStartTime = performance.now();

      logger.info('Початок ініціалізації модулів системи завдань', 'init', {
        category: LOG_CATEGORIES.INIT
      });

      // Реєструємо себе як сервіс для інших модулів
      this.registerModule('TaskIntegration', this);

      // Діагностика системи
      this.diagnoseSystemState();

      // Налаштування обробників помилок
      this.setupErrorHandlers();

      // Перевіряємо стан DOM
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.startInitializationProcess());
      } else {
        this.startInitializationProcess();
      }
    } catch (error) {
      logger.fatal(error, 'Критична помилка при ініціалізації TaskIntegration', {
        category: LOG_CATEGORIES.INIT
      });
    }
  }

  /**
   * Діагностика стану системи
   */
  diagnoseSystemState() {
    try {
      logger.info('Діагностика стану системи...', 'diagnoseSystemState');

      // Збираємо інформацію про стан
      const diagnosticInfo = {
        documentReadyState: document.readyState,
        apiAvailable: !!window.API,
        apiPathsAvailable: !!window.API_PATHS,
        moduleAvailability: {}
      };

      // Перевіряємо наявність критичних модулів
      this.criticalModules.forEach(moduleName => {
        // Спочатку перевіряємо в контейнері залежностей
        let moduleAvailable = this.dependencyContainer.has(moduleName);

        // Якщо не знайдено в контейнері, перевіряємо в window
        if (!moduleAvailable) {
          moduleAvailable = this.getModuleObject(moduleName) !== null;

          // Якщо знайдено в window, автоматично реєструємо в контейнері
          if (moduleAvailable) {
            const moduleObject = this.getModuleObject(moduleName);
            this.registerModule(moduleName, moduleObject);
          }
        }

        diagnosticInfo.moduleAvailability[moduleName] = moduleAvailable;
      });

      // Логуємо діагностичну інформацію
      logger.info('Результати діагностики', 'diagnoseSystemState', {
        category: LOG_CATEGORIES.INIT,
        details: diagnosticInfo
      });

      // Перевіряємо і виправляємо API_PATHS
      this.fixApiPathsIfNeeded();

      // Перевіряємо ID користувача
      const userIdResult = this.safeGetUserId();
      logger.info('Результат отримання ID користувача', 'diagnoseSystemState', {
        category: LOG_CATEGORIES.INIT,
        details: userIdResult
      });
    } catch (error) {
      logger.error(error, 'Помилка під час діагностики стану системи', {
        category: LOG_CATEGORIES.INIT
      });
    }
  }

  /**
   * Запуск процесу ініціалізації
   */
  startInitializationProcess() {
    try {
      // Автоматична реєстрація модулів, які є в global scope
      this.autoRegisterGlobalModules();

      // Ініціалізація модулів у правильному порядку
      this.initModulesInOrder();

      // Встановлюємо таймаут для перевірки стану ініціалізації
      setTimeout(() => this.checkInitializationStatus(), 500);

      // Встановлюємо загальний таймаут ініціалізації
      setTimeout(() => {
        if (!this.state.initialized) {
          logger.warn('Перевищено час очікування ініціалізації. Перевірка стану...', 'startInitializationProcess', {
            category: LOG_CATEGORIES.TIMEOUT
          });
          this.finalizeInitialization(true);
        }
      }, this.config.initTimeout);

      // Налаштовуємо спостереження за DOM
      if (this.config.monitorDomMutations) {
        this.setupDomObserver();
      }
    } catch (error) {
      logger.error(error, 'Помилка запуску процесу ініціалізації', {
        category: LOG_CATEGORIES.INIT
      });
    }
  }

  /**
   * Автоматична реєстрація модулів із глобального простору
   */
  autoRegisterGlobalModules() {
    try {
      logger.info('Автоматична реєстрація глобальних модулів...', 'autoRegisterGlobalModules');

      // Проходимо по всіх критичних модулях
      this.criticalModules.forEach(moduleName => {
        // Якщо модуль ще не зареєстрований в контейнері
        if (!this.dependencyContainer.has(moduleName)) {
          const moduleObj = this.getModuleObject(moduleName);
          if (moduleObj) {
            this.registerModule(moduleName, moduleObj);
            logger.info(`Модуль ${moduleName} автоматично зареєстровано з глобального простору`, 'autoRegisterGlobalModules');
          }
        }
      });

      // Перевіряємо вкладені модулі (UI.*)
      Object.keys(this.dependencies)
        .filter(name => name.includes('.'))
        .forEach(moduleName => {
          if (!this.dependencyContainer.has(moduleName)) {
            const moduleObj = this.getModuleObject(moduleName);
            if (moduleObj) {
              this.registerModule(moduleName, moduleObj);
              logger.info(`Вкладений модуль ${moduleName} автоматично зареєстровано`, 'autoRegisterGlobalModules');
            }
          }
        });
    } catch (error) {
      logger.error(error, 'Помилка автоматичної реєстрації глобальних модулів', {
        category: LOG_CATEGORIES.INIT
      });
    }
  }

  /**
   * Ініціалізація модулів у правильному порядку
   */
  initModulesInOrder() {
    try {
      logger.info('Початок ініціалізації модулів у пріоритетному порядку', 'initModulesInOrder');

      // Отримуємо список модулів, відсортований за пріоритетом
      const modulesToInit = this.getSortedModules();

      // Ініціалізуємо модулі відповідно до їх пріоритету
      for (const moduleName of modulesToInit) {
        this.initializeModule(moduleName);
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
   * Ініціалізація конкретного модуля
   * @param {string} moduleName - Назва модуля
   * @returns {boolean} Результат ініціалізації
   */
  initializeModule(moduleName) {
    try {
      // Якщо модуль вже ініціалізовано, пропускаємо
      if (this.state.moduleStates[moduleName] === 'ready') {
        return true;
      }

      // Відзначаємо, що ініціалізація почалася
      this.state.moduleStates[moduleName] = 'initializing';
      this.state.initializationTimestamps[moduleName] = performance.now();

      // Отримуємо посилання на модуль з контейнера залежностей
      let moduleObj = this.dependencyContainer.resolve(moduleName);

      // Якщо модуля немає в контейнері, спробуємо отримати з window
      if (!moduleObj) {
        moduleObj = this.getModuleObject(moduleName);

        // Якщо модуль знайдено, реєструємо його в контейнері
        if (moduleObj) {
          this.registerModule(moduleName, moduleObj);
        }
      }

      // Якщо модуль не існує, позначаємо як невдалий
      if (!moduleObj) {
        this.state.moduleStates[moduleName] = 'not_found';
        this.state.failedModules.push(moduleName);

        logger.warn(`Модуль ${moduleName} не знайдено`, 'initializeModule', {
          category: LOG_CATEGORIES.INIT
        });

        return false;
      }

      // Перевіряємо, чи всі залежності ініціалізовані
      const dependenciesReady = this.checkDependenciesReady(moduleName);

      if (!dependenciesReady) {
        if (this.config.detailedLogging) {
          logger.info(`Очікуємо залежності для модуля ${moduleName}`, 'initializeModule', {
            category: LOG_CATEGORIES.INIT,
            details: { moduleName, dependencies: this.dependencies[moduleName]?.deps || [] }
          });
        }

        // Якщо не всі залежності готові, відкладаємо ініціалізацію
        setTimeout(() => {
          if (this.state.moduleStates[moduleName] !== 'ready') {
            this.initializeModule(moduleName);
          }
        }, 100);

        return false;
      }

      // Ін'єктуємо залежності перед ініціалізацією
      this.injectDependencies(moduleObj, moduleName);

      // Якщо у модуля є метод init, викликаємо його
      if (typeof moduleObj.init === 'function' || typeof moduleObj.initialize === 'function') {
        const initMethod = moduleObj.init || moduleObj.initialize;
        initMethod.call(moduleObj);
        this.state.moduleStates[moduleName] = 'ready';

        logger.info(`Модуль ${moduleName} успішно ініціалізовано`, 'initializeModule', {
          category: LOG_CATEGORIES.INIT
        });

        // Вирішуємо конфлікти, якщо потрібно
        if (this.config.autoResolveConflicts && !this.state.conflictResolutionApplied) {
          this.resolveModuleConflicts();
        }

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

      // Створюємо інформативну подію про помилку
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
        const depObj = this.dependencyContainer.resolve(depName);

        // Якщо залежність знайдено
        if (depObj) {
          // Назва сервісу без крапок для встановлення в властивості
          const serviceName = depName.includes('.')
            ? depName.split('.').pop()
            : depName;

          // Назва властивості з маленької літери для camelCase
          const propName = serviceName.charAt(0).toLowerCase() + serviceName.slice(1);

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
   * Отримання об'єкта модуля за його назвою
   * @param {string} moduleName - Назва модуля
   * @returns {Object|null} Об'єкт модуля або null
   */
  getModuleObject(moduleName) {
    try {
      // Спочатку шукаємо в контейнері залежностей
      const moduleFromContainer = this.dependencyContainer.resolve(moduleName);
      if (moduleFromContainer) {
        return moduleFromContainer;
      }

      // Обробка спеціальних випадків (залишаємо для зворотньої сумісності)
      switch (moduleName) {
        case 'TaskProgress':
          // Якщо є імпорт, використовуємо його
          try {
            const taskProgress = this.dependencyContainer.resolve('taskProgress');
            if (taskProgress) return taskProgress;
          } catch (err) {}

          // Інакше шукаємо в window
          return window.TaskProgress || null;
        case 'TaskVerification':
          try {
            const taskVerification = this.dependencyContainer.resolve('taskVerification');
            if (taskVerification) return taskVerification;
          } catch (err) {}

          return window.TaskVerification || null;
        case 'TaskStore':
          try {
            const taskStore = this.dependencyContainer.resolve('taskStore');
            if (taskStore) return taskStore;
          } catch (err) {}

          return window.TaskStore || null;
        case 'TaskSystem':
          try {
            const taskSystem = this.dependencyContainer.resolve('taskSystem');
            if (taskSystem) return taskSystem;
          } catch (err) {}

          // Для TaskSystem перевіряємо window.TaskManager для зворотної сумісності
          if (window.TaskManager) {
            return window.TaskManager;
          }
          // Повертаємо TaskSystem з window, якщо він є
          return window.TaskSystem;
      }

      // Обробка вкладених модулів для UI компонентів
      if (moduleName.includes('.')) {
        const parts = moduleName.split('.');
        let obj = window;

        for (const part of parts) {
          if (obj && obj[part]) {
            obj = obj[part];
          } else {
            return null;
          }
        }

        return obj;
      }

      // Звичайний випадок - пошук у глобальному об'єкті window
      return window[moduleName];
    } catch (error) {
      logger.error(error, `Помилка отримання об'єкта модуля ${moduleName}`, {
        category: LOG_CATEGORIES.LOGIC,
        details: { moduleName }
      });
      return null;
    }
  }

  /**
   * Перевірка готовності всіх залежностей модуля
   * @param {string} moduleName - Назва модуля
   * @returns {boolean} Чи всі залежності готові
   */
  checkDependenciesReady(moduleName) {
    try {
      // Отримуємо список залежностей
      const deps = this.dependencies[moduleName]?.deps || [];

      // Якщо немає залежностей, повертаємо true
      if (deps.length === 0) {
        return true;
      }

      // Перевіряємо статус кожної залежності
      return deps.every(dep => {
        // Спочатку перевіряємо, чи залежність зареєстрована в контейнері
        const isInContainer = this.dependencyContainer.has(dep);

        // Потім перевіряємо статус ініціалізації
        const initStatus = this.state.moduleStates[dep];

        return isInContainer && initStatus === 'ready';
      });
    } catch (error) {
      logger.error(error, `Помилка перевірки залежностей модуля ${moduleName}`, {
        category: LOG_CATEGORIES.LOGIC,
        details: { moduleName, dependencies: this.dependencies[moduleName]?.deps || [] }
      });
      return false;
    }
  }

  /**
   * Перевірка статусу ініціалізації
   */
  checkInitializationStatus() {
    try {
      // Отримуємо список критичних модулів, які не ініціалізовано
      const pendingCriticalModules = this.criticalModules.filter(
        m => this.state.moduleStates[m] !== 'ready' && this.state.moduleStates[m] !== 'not_found'
      );

      if (pendingCriticalModules.length === 0) {
        // Всі критичні модулі ініціалізовано або недоступні
        this.finalizeInitialization();
      } else if (pendingCriticalModules.length > 0) {
        // Ще є модулі, які чекають ініціалізації
        logger.info(`Очікуємо ініціалізації модулів: ${pendingCriticalModules.join(', ')}`, 'checkInitializationStatus', {
          category: LOG_CATEGORIES.INIT
        });

        // Повторюємо перевірку через 300мс
        setTimeout(() => this.checkInitializationStatus(), 300);
      }
    } catch (error) {
      logger.error(error, 'Помилка перевірки статусу ініціалізації', {
        category: LOG_CATEGORIES.INIT
      });
    }
  }

  /**
   * Завершення процесу ініціалізації
   * @param {boolean} timedOut - Чи відбувся таймаут
   */
  finalizeInitialization(timedOut = false) {
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

      // Запускаємо додаткові операції після ініціалізації
      if (allCriticalReady) {
        logger.info(`Всі критичні модулі успішно ініціалізовано за ${Math.round(initDuration)}мс`, 'finalizeInitialization', {
          category: LOG_CATEGORIES.INIT,
          details: {
            initDuration: Math.round(initDuration),
            moduleStates: { ...this.state.moduleStates }
          }
        });

        // Застосовуємо додаткові налаштування якщо потрібно
        if (this.config.autoResolveConflicts && !this.state.conflictResolutionApplied) {
          this.resolveModuleConflicts();
        }

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

        // Якщо досягнуто таймаут ініціалізації
        if (timedOut) {
          logger.warn(`Ініціалізація завершена по таймауту за ${Math.round(initDuration)}мс`, 'finalizeInitialization', {
            category: LOG_CATEGORIES.TIMEOUT,
            details: {
              initDuration: Math.round(initDuration),
              moduleStates: { ...this.state.moduleStates },
              failedModules: [...this.state.failedModules]
            }
          });

          // Відправляємо подію про часткову ініціалізацію
          document.dispatchEvent(new CustomEvent('task-system-partial-init', {
            detail: {
              modules: Object.keys(this.state.moduleStates).filter(m => this.state.moduleStates[m] === 'ready'),
              failed: Object.keys(this.state.moduleStates).filter(m => this.state.moduleStates[m] === 'failed'),
              notFound: Object.keys(this.state.moduleStates).filter(m => this.state.moduleStates[m] === 'not_found'),
              initTime: Math.round(initDuration),
              timestamp: Date.now(),
              timedOut: true
            }
          }));
        }
      }
    } catch (error) {
      logger.fatal(error, 'Критична помилка завершення ініціалізації', {
        category: LOG_CATEGORIES.INIT
      });
    }
  }

  /**
   * Виправлення проблем з API_PATHS
   */
  fixApiPathsIfNeeded() {
    try {
      // Перевіряємо наявність API_PATHS
      if (!window.API_PATHS) {
        logger.warn('API_PATHS відсутній, створюємо...', 'fixApiPathsIfNeeded', {
          category: LOG_CATEGORIES.INIT
        });

        window.API_PATHS = {
          TASKS: {
            SOCIAL: 'quests/tasks/social',
            LIMITED: 'quests/tasks/limited',
            PARTNER: 'quests/tasks/partner',
            REFERRAL: 'quests/tasks/referral'
          }
        };

        // Реєструємо API_PATHS в контейнері залежностей
        this.registerModule('API_PATHS', window.API_PATHS);
        return;
      }

      // Перевіряємо наявність API_PATHS.TASKS
      if (!window.API_PATHS.TASKS) {
        logger.warn('API_PATHS.TASKS відсутній, створюємо...', 'fixApiPathsIfNeeded', {
          category: LOG_CATEGORIES.INIT
        });

        window.API_PATHS.TASKS = {
          SOCIAL: 'quests/tasks/social',
          LIMITED: 'quests/tasks/limited',
          PARTNER: 'quests/tasks/partner',
          REFERRAL: 'quests/tasks/referral'
        };

        // Реєструємо оновлений API_PATHS в контейнері залежностей
        this.registerModule('API_PATHS', window.API_PATHS);
        return;
      }

      // Перевіряємо наявність REFERRAL шляху
      if (!window.API_PATHS.TASKS.REFERRAL) {
        logger.info('Створення REFERRAL шляху...', 'fixApiPathsIfNeeded', {
          category: LOG_CATEGORIES.INIT
        });

        window.API_PATHS.TASKS.REFERRAL = window.API_PATHS.TASKS.SOCIAL;
      }

      // Виправляємо PARTNERS на PARTNER, якщо потрібно
      if (window.API_PATHS.TASKS.PARTNERS && !window.API_PATHS.TASKS.PARTNER) {
        logger.info('Виправлення PARTNERS на PARTNER...', 'fixApiPathsIfNeeded', {
          category: LOG_CATEGORIES.INIT
        });

        window.API_PATHS.TASKS.PARTNER = window.API_PATHS.TASKS.PARTNERS;
      }

      // Реєструємо API_PATHS в контейнері залежностей
      this.registerModule('API_PATHS', window.API_PATHS);
    } catch (error) {
      logger.error(error, 'Помилка виправлення API_PATHS', {
        category: LOG_CATEGORIES.INIT
      });
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
          const userIdResult = this.safeGetUserId();
          if (!userIdResult.success) {
            if (this.config.fallbackUserMode) {
              logger.info('Повертаємо тимчасовий ID для режиму fallback', 'getUserId');
              return 'temp_user_' + Math.random().toString(36).substring(2, 9);
            }
            return null;
          }
          return userIdResult.userId;
        }
      };

      this.registerModule('UserIdProvider', userIdProvider);

      // Перевіряємо, чи є функція getUserId
      if (typeof window.getUserId !== 'function') {
        logger.info('Створення глобальної функції getUserId...', 'fixUserIdIssues', {
          category: LOG_CATEGORIES.INIT
        });

        // Створюємо функцію getUserId, яка використовує зареєстрований провайдер
        window.getUserId = userIdProvider.getUserId;
      }

      // Ін'єктуємо userIdProvider у всі модулі, що потребують ID користувача
      Object.keys(this.state.moduleStates)
        .filter(moduleName => this.state.moduleStates[moduleName] === 'ready')
        .forEach(moduleName => {
          const moduleObj = this.dependencyContainer.resolve(moduleName);
          if (moduleObj && typeof moduleObj === 'object') {
            // Перевіряємо, чи у модуля є метод getUserId або він його використовує
            if (typeof moduleObj.getUserId === 'function' || moduleObj.hasOwnProperty('userId')) {
              moduleObj.userIdProvider = userIdProvider;
              logger.info(`Ін'єктовано UserIdProvider в модуль ${moduleName}`, 'fixUserIdIssues');
            }
          }
        });
    } catch (error) {
      logger.error(error, 'Помилка при виправленні проблем з ID користувача', {
        category: LOG_CATEGORIES.INIT
      });
    }
  }

  /**
   * Безпечне отримання ID користувача з обробкою помилок
   * @returns {Object} Результат отримання ID користувача
   */
  safeGetUserId() {
    try {
      // Спробуємо отримати ID користувача через звичайну функцію getUserId
      if (typeof window.getUserId === 'function') {
        const userId = window.getUserId();
        if (userId) {
          return { success: true, userId: userId };
        }
      }

      // Спробуємо знайти ID в localStorage
      try {
        const storedId = localStorage.getItem('telegram_user_id');
        if (storedId && storedId !== 'undefined' && storedId !== 'null') {
          return { success: true, userId: storedId, source: 'localStorage' };
        }
      } catch (storageError) {
        logger.warn(storageError, 'Помилка доступу до localStorage', {
          category: LOG_CATEGORIES.LOGIC
        });
      }

      // Спробуємо отримати з DOM
      try {
        // Шукаємо в усіх можливих місцях
        const possibleElements = [
          document.getElementById('user-id'),
          document.getElementById('header-user-id'),
          document.querySelector('[data-user-id]')
        ];

        for (const element of possibleElements) {
          if (element && element.textContent) {
            const userId = element.textContent.trim();
            if (userId) {
              return { success: true, userId: userId, source: 'DOM' };
            }
          }
        }
      } catch (domError) {
        logger.warn(domError, 'Помилка доступу до DOM', {
          category: LOG_CATEGORIES.LOGIC
        });
      }

      // Спробуємо отримати з URL-параметрів
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
        if (id) {
          return { success: true, userId: id, source: 'URL' };
        }
      } catch (urlError) {
        logger.warn(urlError, 'Помилка парсингу URL', {
          category: LOG_CATEGORIES.LOGIC
        });
      }

      // Спробуємо отримати з Telegram WebApp
      try {
        if (window.Telegram && window.Telegram.WebApp &&
          window.Telegram.WebApp.initDataUnsafe &&
          window.Telegram.WebApp.initDataUnsafe.user &&
          window.Telegram.WebApp.initDataUnsafe.user.id) {

          const telegramId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
          if (telegramId) {
            return { success: true, userId: telegramId, source: 'TelegramWebApp' };
          }
        }
      } catch (telegramError) {
        logger.warn(telegramError, 'Помилка доступу до Telegram WebApp', {
          category: LOG_CATEGORIES.LOGIC
        });
      }

      // Не знайдено ID користувача
      logger.warn('ID користувача не знайдено', 'safeGetUserId', {
        category: LOG_CATEGORIES.AUTH
      });

      return {
        success: false,
        error: 'ID користувача не знайдено',
        fallbackAvailable: this.config.fallbackUserMode,
        requiresAuth: true
      };
    } catch (error) {
      logger.error(error, 'Помилка отримання ID користувача', {
        category: LOG_CATEGORIES.AUTH
      });

      return {
        success: false,
        error: error.message || 'Помилка отримання ID користувача',
        originalError: error,
        fallbackAvailable: this.config.fallbackUserMode,
        requiresAuth: true
      };
    }
  }

  /**
   * Налаштування спостереження за DOM для динамічних елементів
   */
  setupDomObserver() {
    if (!window.MutationObserver) {
      logger.warn('MutationObserver не підтримується в цьому браузері', 'setupDomObserver', {
        category: LOG_CATEGORIES.LOGIC
      });
      return;
    }

    try {
      // Створюємо спостерігач за DOM
      this.domObserver = new MutationObserver(mutations => {
        let hasContentChanges = false;

        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length) {
            hasContentChanges = true;
          }
        });

        // Якщо були додані нові елементи, реагуємо на зміни
        if (hasContentChanges) {
          this.handleDomChanges();
        }
      });

      // Починаємо спостереження за всім документом
      this.domObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

      logger.info('Налаштовано спостереження за DOM', 'setupDomObserver');
    } catch (error) {
      logger.error(error, 'Помилка при налаштуванні спостереження за DOM', {
        category: LOG_CATEGORIES.LOGIC
      });
    }
  }

  /**
   * Обробка змін в DOM
   */
  handleDomChanges() {
    try {
      // Тут можна додати логіку для реагування на зміни в DOM
      // Наприклад, прикріплення обробників до нових елементів завдань

      // Для майбутньої розробки - відстеження появи нових елементів завдань
      const taskElements = document.querySelectorAll('.task-item:not([data-initialized])');
      if (taskElements.length > 0) {
        logger.info(`Виявлено ${taskElements.length} нових елементів завдань`, 'handleDomChanges', {
          category: LOG_CATEGORIES.LOGIC
        });

        // Отримуємо рендерери з контейнера залежностей
        const socialRenderer = this.dependencyContainer.resolve('SocialRenderer');
        const limitedRenderer = this.dependencyContainer.resolve('LimitedRenderer');
        const partnerRenderer = this.dependencyContainer.resolve('PartnerRenderer');

        // Ініціалізуємо нові елементи через відповідні рендерери
        taskElements.forEach(element => {
          const taskType = element.dataset.taskType;
          const taskId = element.dataset.taskId;

          if (taskId) {
            // Отримуємо завдання та прогрес
            let task, progress;

            // Спершу через TaskSystem
            const taskSystem = this.dependencyContainer.resolve('TaskSystem');
            if (taskSystem) {
              task = taskSystem.findTaskById(taskId);
              progress = taskSystem.getTaskProgress(taskId);
            } else if (window.TaskManager) {
              // Для зворотної сумісності
              task = window.TaskManager.findTaskById(taskId);
              progress = window.TaskManager.getTaskProgress(taskId);
            }

            // Ініціалізуємо через правильний рендерер
            if (task) {
              element.setAttribute('data-initialized', 'true');

              switch (taskType) {
                case 'social':
                  if (socialRenderer && typeof socialRenderer.render === 'function') {
                    socialRenderer.render(task, progress);
                  }
                  break;
                case 'limited':
                  if (limitedRenderer && typeof limitedRenderer.render === 'function') {
                    limitedRenderer.render(task, progress);
                  }
                  break;
                case 'partner':
                  if (partnerRenderer && typeof partnerRenderer.render === 'function') {
                    partnerRenderer.render(task, progress);
                  }
                  break;
              }
            }
          }
        });
      }
    } catch (error) {
      logger.warn(error, 'Помилка обробки змін в DOM', {
        category: LOG_CATEGORIES.LOGIC
      });
    }
  }

  /**
   * Налаштування обробників помилок
   */
  setupErrorHandlers() {
    try {
      // Обробка помилок вже відбувається через загальний ErrorHandler
      // Тут ми додаємо лише додаткові обробники для системи завдань

      // Підписуємось на події від ErrorHandler
      document.addEventListener('app-error-critical', (event) => {
        const errorDetail = event.detail;

        // Реагуємо на критичні помилки у модулях завдань
        if (errorDetail.module && errorDetail.module.startsWith('Task')) {
          // Автоматичне відновлення при критичних помилках
          if (this.config.autoRetryOnFailure) {
            setTimeout(() => {
              logger.info('Спроба відновлення після критичної помилки...', 'errorHandler');
              this.recoverFailedModules();
            }, 1000);
          }
        }
      });

      logger.info('Налаштовано обробники помилок', 'setupErrorHandlers');
    } catch (error) {
      logger.error(error, 'Помилка при налаштуванні обробників помилок', {
        category: LOG_CATEGORIES.INIT
      });
    }
  }

  /**
   * Вирішення конфліктів між модулями
   */
  resolveModuleConflicts() {
    if (this.state.conflictResolutionApplied) return;

    try {
      logger.info('Синхронізація інтерфейсів між модулями...', 'resolveModuleConflicts');

      // Отримуємо модулі з контейнера залежностей
      const taskSystem = this.dependencyContainer.resolve('TaskSystem');
      const taskProgress = this.dependencyContainer.resolve('TaskProgress');
      const taskVerification = this.dependencyContainer.resolve('TaskVerification');
      const taskStore = this.dependencyContainer.resolve('TaskStore');

      // Синхронізуємо TaskManager з TaskProgress
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

      // Синхронізуємо TaskManager з TaskVerification
      if (taskSystem && taskVerification) {
        if (!taskSystem.verifyTask) {
          taskSystem.verifyTask = taskVerification.verifyTask.bind(taskVerification);
        }

        logger.info('Налаштовано делегування методів верифікації', 'resolveModuleConflicts');
      }

      // Синхронізуємо типи винагород
      if (taskSystem && taskSystem.REWARD_TYPES) {
        const rewardTypes = taskSystem.REWARD_TYPES;

        // Передаємо в інші модулі
        if (taskStore) {
          taskStore.REWARD_TYPES = rewardTypes;
        }

        if (taskVerification) {
          taskVerification.REWARD_TYPES = rewardTypes;
        }

        logger.info('Синхронізовано типи винагород між модулями', 'resolveModuleConflicts');
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
        this.registerModule('TaskManager', window.TaskManager);
      }

      this.state.conflictResolutionApplied = true;
    } catch (error) {
      logger.error(error, 'Помилка при вирішенні конфліктів між модулями', {
        category: LOG_CATEGORIES.LOGIC
      });
    }
  }

  /**
   * Спроба відновлення невдалих модулів
   */
  recoverFailedModules() {
    try {
      // Отримуємо список невдалих критичних модулів
      const failedCritical = this.criticalModules.filter(m => this.state.moduleStates[m] === 'failed');

      if (failedCritical.length === 0) {
        logger.info('Немає невдалих критичних модулів для відновлення', 'recoverFailedModules');
        return;
      }

      logger.info(`Спроба відновлення модулів: ${failedCritical.join(', ')}`, 'recoverFailedModules');

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
          this.initializeModule(moduleName);

          logger.info(`Успішно відновлено модуль ${moduleName}`, 'recoverFailedModules');
        } catch (moduleError) {
          logger.error(moduleError, `Помилка при спробі відновлення модуля ${moduleName}`, {
            category: LOG_CATEGORIES.INIT,
            details: { moduleName }
          });
        }
      }
    } catch (error) {
      logger.error(error, 'Помилка при відновленні невдалих модулів', {
        category: LOG_CATEGORIES.LOGIC
      });
    }
  }

  /**
   * Діагностика системи
   * @returns {Object} Діагностична інформація
   */
  diagnose() {
    try {
      const diagnosticInfo = {
        state: { ...this.state },
        moduleStates: { ...this.state.moduleStates },
        failedModules: [...this.state.failedModules],
        initTime: this.state.initEndTime - this.state.initStartTime,
        initialized: this.state.initialized,
        registeredModules: this.dependencyContainer.getRegisteredModules(),
        userId: this.safeGetUserId()
      };

      logger.info('Діагностична інформація зібрана', 'diagnose', {
        category: LOG_CATEGORIES.LOGIC,
        details: diagnosticInfo
      });

      return diagnosticInfo;
    } catch (error) {
      logger.error(error, 'Помилка діагностики системи', {
        category: LOG_CATEGORIES.LOGIC
      });

      return {
        error: error.message,
        timestamp: Date.now()
      };
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

      // Очищаємо контейнер залежностей, крім самого себе
      this.dependencyContainer.reset(['TaskIntegration']);

      // Видаляємо обробник спостереження за DOM
      if (this.domObserver) {
        this.domObserver.disconnect();
        this.domObserver = null;
      }

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

// Створюємо і експортуємо єдиний екземпляр сервісу інтеграції
const taskIntegration = new TaskIntegration();

// Для зворотної сумісності зі старою системою, додаємо в глобальний простір
window.TaskIntegration = taskIntegration;

// Ініціалізуємо модуль при завантаженні скрипту
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => taskIntegration.init());
} else {
  // Невелика затримка для завершення завантаження інших скриптів
  setTimeout(() => taskIntegration.init(), 100);
}

export default taskIntegration;