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
import taskStore from './task-store.js';
import taskProgress from './task-progress.js';
import taskVerification from './task-verification.js';
import taskApi from './task-api.js';

class TaskIntegration {
  constructor() {
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
      'UI.ProgressBar': { deps: [], priority: 2 },
      'TaskProgress': { deps: ['UI.Animations', 'UI.Notifications', 'UI.ProgressBar'], priority: 3 },
      'TaskVerification': { deps: [], priority: 3 },
      'TaskStore': { deps: ['TaskProgress', 'TaskVerification'], priority: 4 },
      'TaskSystem': { deps: ['TaskStore', 'TaskProgress', 'TaskVerification'], priority: 5 }
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
   * Ініціалізація сервісу інтеграції
   * @param {Object} options - Налаштування
   */
  init(options = {}) {
    // Якщо ініціалізація вже почалася, не запускаємо знову
    if (this.state.initStarted) {
      this.log('TaskIntegration: Ініціалізація вже розпочата');
      return;
    }

    // Оновлюємо конфігурацію
    Object.assign(this.config, options);

    this.state.initStarted = true;
    this.state.initStartTime = performance.now();

    this.log('TaskIntegration: Початок ініціалізації модулів системи завдань');

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
  }

  /**
   * Діагностика стану системи
   */
  diagnoseSystemState() {
    this.log('TaskIntegration: Діагностика стану системи...');
    this.log('document.readyState =', document.readyState);
    this.log('window.API доступний?', !!window.API);
    this.log('window.API_PATHS доступний?', !!window.API_PATHS);

    // Перевіряємо наявність критичних модулів
    this.criticalModules.forEach(moduleName => {
      const moduleAvailable = this.getModuleObject(moduleName) !== null;
      this.log(`Модуль ${moduleName} доступний?`, moduleAvailable);
    });

    // Перевіряємо і виправляємо API_PATHS
    this.fixApiPathsIfNeeded();

    // Перевіряємо ID користувача
    const userIdResult = this.safeGetUserId();
    this.log('Результат отримання ID користувача:', userIdResult);
  }

  /**
   * Запуск процесу ініціалізації
   */
  startInitializationProcess() {
    // Ініціалізація модулів у правильному порядку
    this.initModulesInOrder();

    // Встановлюємо таймаут для перевірки стану ініціалізації
    setTimeout(() => this.checkInitializationStatus(), 500);

    // Встановлюємо загальний таймаут ініціалізації
    setTimeout(() => {
      if (!this.state.initialized) {
        this.log('TaskIntegration: Перевищено час очікування ініціалізації. Перевірка стану...');
        this.finalizeInitialization(true);
      }
    }, this.config.initTimeout);

    // Налаштовуємо спостереження за DOM
    if (this.config.monitorDomMutations) {
      this.setupDomObserver();
    }
  }

  /**
   * Ініціалізація модулів у правильному порядку
   */
  initModulesInOrder() {
    try {
      this.log('TaskIntegration: Початок ініціалізації модулів у пріоритетному порядку');

      // Отримуємо список модулів, відсортований за пріоритетом
      const modulesToInit = this.getSortedModules();

      // Ініціалізуємо модулі відповідно до їх пріоритету
      for (const moduleName of modulesToInit) {
        this.initializeModule(moduleName);
      }
    } catch (error) {
      this.logError('Помилка при ініціалізації модулів:', error);
    }
  }

  /**
   * Отримання відсортованого списку модулів за пріоритетом
   * @returns {Array} Відсортований список модулів
   */
  getSortedModules() {
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
  }

  /**
   * Ініціалізація конкретного модуля
   * @param {string} moduleName - Назва модуля
   * @returns {boolean} Результат ініціалізації
   */
  initializeModule(moduleName) {
    // Якщо модуль вже ініціалізовано, пропускаємо
    if (this.state.moduleStates[moduleName] === 'ready') {
      return true;
    }

    // Відзначаємо, що ініціалізація почалася
    this.state.moduleStates[moduleName] = 'initializing';
    this.state.initializationTimestamps[moduleName] = performance.now();

    try {
      // Отримуємо посилання на модуль
      const moduleObj = this.getModuleObject(moduleName);

      // Якщо модуль не існує, позначаємо як невдалий
      if (!moduleObj) {
        this.state.moduleStates[moduleName] = 'not_found';
        this.state.failedModules.push(moduleName);
        return false;
      }

      // Перевіряємо, чи всі залежності ініціалізовані
      const dependenciesReady = this.checkDependenciesReady(moduleName);

      if (!dependenciesReady) {
        if (this.config.detailedLogging) {
          this.log(`TaskIntegration: Очікуємо залежності для модуля ${moduleName}`);
        }

        // Якщо не всі залежності готові, відкладаємо ініціалізацію
        setTimeout(() => {
          if (this.state.moduleStates[moduleName] !== 'ready') {
            this.initializeModule(moduleName);
          }
        }, 100);

        return false;
      }

      // Якщо у модуля є метод init, викликаємо його
      if (typeof moduleObj.init === 'function' || typeof moduleObj.initialize === 'function') {
        const initMethod = moduleObj.init || moduleObj.initialize;
        initMethod.call(moduleObj);
        this.state.moduleStates[moduleName] = 'ready';

        this.log(`TaskIntegration: Модуль ${moduleName} успішно ініціалізовано`);

        // Вирішуємо конфлікти, якщо потрібно
        if (this.config.autoResolveConflicts && !this.state.conflictResolutionApplied) {
          this.resolveModuleConflicts();
        }

        return true;
      } else {
        // Якщо немає методу init, вважаємо що модуль вже ініціалізовано
        this.state.moduleStates[moduleName] = 'ready';
        this.log(`TaskIntegration: Модуль ${moduleName} не має методу init, вважаємо його готовим`);
        return true;
      }
    } catch (error) {
      this.logError(`Помилка при ініціалізації модуля ${moduleName}:`, error);

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
   * Отримання об'єкта модуля за його назвою
   * @param {string} moduleName - Назва модуля
   * @returns {Object|null} Об'єкт модуля або null
   */
  getModuleObject(moduleName) {
    // Обробка спеціальних випадків
    switch (moduleName) {
      case 'TaskProgress':
        return taskProgress;
      case 'TaskVerification':
        return taskVerification;
      case 'TaskStore':
        return taskStore;
      case 'TaskSystem':
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
  }

  /**
   * Перевірка готовності всіх залежностей модуля
   * @param {string} moduleName - Назва модуля
   * @returns {boolean} Чи всі залежності готові
   */
  checkDependenciesReady(moduleName) {
    // Отримуємо список залежностей
    const deps = this.dependencies[moduleName]?.deps || [];

    // Якщо немає залежностей, повертаємо true
    if (deps.length === 0) {
      return true;
    }

    // Перевіряємо статус кожної залежності
    return deps.every(dep => this.state.moduleStates[dep] === 'ready');
  }

  /**
   * Перевірка статусу ініціалізації
   */
  checkInitializationStatus() {
    // Отримуємо список критичних модулів, які не ініціалізовано
    const pendingCriticalModules = this.criticalModules.filter(
      m => this.state.moduleStates[m] !== 'ready' && this.state.moduleStates[m] !== 'not_found'
    );

    if (pendingCriticalModules.length === 0) {
      // Всі критичні модулі ініціалізовано або недоступні
      this.finalizeInitialization();
    } else if (pendingCriticalModules.length > 0) {
      // Ще є модулі, які чекають ініціалізації
      this.log(`TaskIntegration: Очікуємо ініціалізації модулів: ${pendingCriticalModules.join(', ')}`);

      // Повторюємо перевірку через 300мс
      setTimeout(() => this.checkInitializationStatus(), 300);
    }
  }

  /**
   * Завершення процесу ініціалізації
   * @param {boolean} timedOut - Чи відбувся таймаут
   */
  finalizeInitialization(timedOut = false) {
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
      this.log(`TaskIntegration: Всі критичні модулі успішно ініціалізовано за ${Math.round(initDuration)}мс`);

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
        this.logError(`TaskIntegration: Не вдалося ініціалізувати критичні модулі: ${failedCritical.join(', ')}`);

        // В автоматичному режимі спробуємо відновити
        if (this.config.autoRetryOnFailure) {
          this.log('TaskIntegration: Спроба відновлення невдалих модулів...');
          this.recoverFailedModules();
        }
      }

      // Якщо досягнуто таймаут ініціалізації
      if (timedOut) {
        this.log(`TaskIntegration: Ініціалізація завершена по таймауту за ${Math.round(initDuration)}мс`);

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
  }

  /**
   * Виправлення проблем з API_PATHS
   */
  fixApiPathsIfNeeded() {
    try {
      // Перевіряємо наявність API_PATHS
      if (!window.API_PATHS) {
        this.log('TaskIntegration: Створення API_PATHS...');
        window.API_PATHS = {
          TASKS: {
            SOCIAL: 'quests/tasks/social',
            LIMITED: 'quests/tasks/limited',
            PARTNER: 'quests/tasks/partner',
            REFERRAL: 'quests/tasks/referral'
          }
        };
        return;
      }

      // Перевіряємо наявність API_PATHS.TASKS
      if (!window.API_PATHS.TASKS) {
        this.log('TaskIntegration: Створення API_PATHS.TASKS...');
        window.API_PATHS.TASKS = {
          SOCIAL: 'quests/tasks/social',
          LIMITED: 'quests/tasks/limited',
          PARTNER: 'quests/tasks/partner',
          REFERRAL: 'quests/tasks/referral'
        };
        return;
      }

      // Перевіряємо наявність REFERRAL шляху
      if (!window.API_PATHS.TASKS.REFERRAL) {
        this.log('TaskIntegration: Створення REFERRAL шляху...');
        window.API_PATHS.TASKS.REFERRAL = window.API_PATHS.TASKS.SOCIAL;
      }

      // Виправляємо PARTNERS на PARTNER, якщо потрібно
      if (window.API_PATHS.TASKS.PARTNERS && !window.API_PATHS.TASKS.PARTNER) {
        this.log('TaskIntegration: Виправлення PARTNERS на PARTNER...');
        window.API_PATHS.TASKS.PARTNER = window.API_PATHS.TASKS.PARTNERS;
      }
    } catch (error) {
      this.logError('Помилка виправлення API_PATHS:', error);
    }
  }

  /**
   * Виправлення проблем з ID користувача у всіх модулях
   */
  fixUserIdIssues() {
    try {
      // Перевіряємо, чи є функція getUserId
      if (typeof window.getUserId !== 'function') {
        this.log('TaskIntegration: Створення глобальної функції getUserId...');

        // Створюємо функцію getUserId
        window.getUserId = () => {
          const userIdResult = this.safeGetUserId();
          if (!userIdResult.success) {
            if (this.config.fallbackUserMode) {
              this.log('TaskIntegration: Повертаємо тимчасовий ID для режиму fallback');
              return 'temp_user_' + Math.random().toString(36).substring(2, 9);
            }
            return null;
          }
          return userIdResult.userId;
        };
      }
    } catch (error) {
      this.logError('Помилка при виправленні проблем з ID користувача:', error);
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
      } catch (e) {
        // Ігноруємо помилки localStorage
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
      } catch (e) {
        // Ігноруємо помилки DOM
      }

      // Спробуємо отримати з URL-параметрів
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
        if (id) {
          return { success: true, userId: id, source: 'URL' };
        }
      } catch (e) {
        // Ігноруємо помилки URL
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
      } catch (e) {
        // Ігноруємо помилки Telegram WebApp
      }

      // Не знайдено ID користувача
      return {
        success: false,
        error: 'ID користувача не знайдено',
        fallbackAvailable: this.config.fallbackUserMode,
        requiresAuth: true
      };
    } catch (error) {
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
    if (!window.MutationObserver) return;

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

      this.log('TaskIntegration: Налаштовано спостереження за DOM');
    } catch (error) {
      this.logError('Помилка при налаштуванні спостереження за DOM:', error);
    }
  }

  /**
   * Обробка змін в DOM
   */
  handleDomChanges() {
    // Тут можна додати логіку для реагування на зміни в DOM
    // Наприклад, прикріплення обробників до нових елементів завдань
  }

  /**
   * Налаштування обробників помилок
   */
  setupErrorHandlers() {
    // Глобальний обробник помилок для відстеження проблем в модулях
    if (!window.onerror) {
      window.onerror = (message, source, lineno, colno, error) => {
        if (source && (source.includes('task-') || source.includes('tasks/'))) {
          this.state.lastError = {
            message,
            source,
            lineno,
            colno,
            error,
            timestamp: Date.now()
          };

          this.logError('Виявлено помилку в модулі завдань:', error || message);

          // Відправляємо подію про помилку
          document.dispatchEvent(new CustomEvent('task-system-error', {
            detail: this.state.lastError
          }));

          // Автоматичне відновлення при критичних помилках
          if (this.config.autoRetryOnFailure) {
            setTimeout(() => {
              this.log('TaskIntegration: Спроба відновлення після помилки...');
              this.recoverFailedModules();
            }, 1000);
          }
        }

        // Не блокуємо стандартну обробку помилок
        return false;
      };
    }

    // Обробник неопрацьованих промісів
    window.addEventListener('unhandledrejection', event => {
      if (event.reason && event.reason.stack &&
          (event.reason.stack.includes('task-') || event.reason.stack.includes('tasks/'))) {

        this.state.lastError = {
          message: event.reason.message,
          error: event.reason,
          stack: event.reason.stack,
          timestamp: Date.now(),
          type: 'promise'
        };

        this.logError('Невідловлена помилка промісу в модулі завдань:', event.reason);

        // Відправляємо подію про помилку
        document.dispatchEvent(new CustomEvent('task-system-promise-error', {
          detail: this.state.lastError
        }));
      }
    });
  }

  /**
   * Вирішення конфліктів між модулями
   */
  resolveModuleConflicts() {
    if (this.state.conflictResolutionApplied) return;

    this.log('TaskIntegration: Синхронізація інтерфейсів між модулями...');

    try {
      // Синхронізуємо TaskManager з TaskProgress
      if (window.TaskManager && taskProgress) {
        // Делегуємо методи прогресу
        if (!window.TaskManager.getTaskProgress) {
          window.TaskManager.getTaskProgress = taskProgress.getTaskProgress.bind(taskProgress);
        }

        if (!window.TaskManager.updateTaskProgress) {
          window.TaskManager.updateTaskProgress = taskProgress.updateTaskProgress.bind(taskProgress);
        }

        this.log('TaskIntegration: Налаштовано делегування методів прогресу');
      }

      // Синхронізуємо TaskManager з TaskVerification
      if (window.TaskManager && taskVerification) {
        if (!window.TaskManager.verifyTask) {
          window.TaskManager.verifyTask = taskVerification.verifyTask.bind(taskVerification);
        }

        this.log('TaskIntegration: Налаштовано делегування методів верифікації');
      }

      // Синхронізуємо типи винагород
      if (window.TaskManager && window.TaskManager.REWARD_TYPES) {
        const rewardTypes = window.TaskManager.REWARD_TYPES;

        // Передаємо в інші модулі
        if (taskStore) {
          taskStore.REWARD_TYPES = rewardTypes;
        }

        if (taskVerification) {
          taskVerification.REWARD_TYPES = rewardTypes;
        }

        this.log('TaskIntegration: Синхронізовано типи винагород між модулями');
      }

      this.state.conflictResolutionApplied = true;
    } catch (error) {
      this.logError('Помилка при вирішенні конфліктів між модулями:', error);
    }
  }

  /**
   * Спроба відновлення невдалих модулів
   */
  recoverFailedModules() {
    // Отримуємо список невдалих критичних модулів
    const failedCritical = this.criticalModules.filter(m => this.state.moduleStates[m] === 'failed');

    if (failedCritical.length === 0) return;

    this.log(`TaskIntegration: Спроба відновлення модулів: ${failedCritical.join(', ')}`);

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
      } catch (error) {
        this.logError(`Помилка при спробі відновлення модуля ${moduleName}:`, error);
      }
    }
  }

  /**
   * Виведення логів з перевіркою налаштувань
   * @param  {...any} args - Аргументи для логування
   */
  log(...args) {
    if (this.config.enableLogging) {
      console.log(...args);
    }
  }

  /**
   * Виведення помилок з додатковою інформацією
   * @param  {...any} args - Аргументи для логування помилок
   */
  logError(...args) {
    console.error(...args);

    // В детальному режимі додаємо стек виклику
    if (this.config.detailedLogging) {
      console.trace('Стек виклику:');
    }
  }

  /**
   * Діагностика системи
   * @returns {Object} Діагностична інформація
   */
  diagnose() {
    return {
      state: { ...this.state },
      moduleStates: { ...this.state.moduleStates },
      failedModules: [...this.state.failedModules],
      initTime: this.state.initEndTime - this.state.initStartTime,
      initialized: this.state.initialized,
      taskProgress: taskProgress ? 'available' : 'not_available',
      taskStore: taskStore ? 'available' : 'not_available',
      taskVerification: taskVerification ? 'available' : 'not_available',
      taskApi: taskApi ? 'available' : 'not_available',
      userId: this.safeGetUserId()
    };
  }

  /**
   * Скидання стану інтеграції для повторної ініціалізації
   */
  reset() {
    // Скидаємо основні прапорці стану
    this.state.initialized = false;
    this.state.initStarted = false;
    this.state.failedModules = [];
    this.state.moduleStates = {};
    this.state.initStartTime = 0;
    this.state.initEndTime = 0;
    this.state.conflictResolutionApplied = false;

    // Видаляємо обробник спостереження за DOM
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }

    this.log('TaskIntegration: Стан інтеграції скинуто');

    return true;
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
