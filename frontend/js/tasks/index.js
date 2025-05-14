/**
 * Головна точка входу для системи завдань
 *
 * Експортує всі необхідні компоненти системи для використання в інших модулях
 *
 * @version 1.1.0
 */

// Експорт конфігурації
export { default as ACTION_TYPES } from './config/action-types.js';
export { default as TASK_STATUS } from './config/status-types.js';
export { default as TASK_TYPES } from './config/task-types.js';
export { default as REWARD_TYPES } from './config/reward-types.js';
export { default as VERIFICATION_STATUS } from './config/verification-status.js';
export { default as SOCIAL_NETWORKS } from './config/social-networks.js';
export {
  DAILY_BONUS_TYPES,
  DAILY_BONUS_CONFIG,
  createDailyBonusModel
} from './config/daily-bonus-types.js';
export { default as CONFIG } from './config/settings.js';

// Експорт базових моделей
export { TaskModel } from './models/base/task-model.js';
export { formatToApiData, formatToDisplayData } from './models/base/formatters.js';
export { isValidTask } from './models/base/validators.js';
export { generateTrackingUrl, hasTrackingParams, removeTrackingParams } from './models/base/tracking.js';

// Експорт моделей типів завдань
export { default as LimitedTaskModel } from './models/types/limited-task-model.js';
export { default as PartnerTaskModel } from './models/types/partner-task-model.js';
export { default as SocialTaskModel } from './models/types/social-task-model.js';
export { default as DailyBonusModel } from './models/types/daily-bonus-model.js';

// Експорт сервісів
export { default as dailyBonusService } from './services/daily-bonus/daily-bonus-service.js';
export { default as DailyBonusCacheHandler } from './services/daily-bonus/cache-handler.js';

// Експорт API модулів
export { default as taskApi } from './api/api.js';
export {
  cacheService,
  requestService,
  actionService,
  taskService,
  progressService,
  dailyBonusApi,
  CONFIG as API_CONFIG,
  API_VERSION,
  API_ERROR_CODES,
} from './api/api.js';

// Експорт сховища та менеджерів даних
export { default as taskStore } from './services/store/task-store.js';
export { default as balanceManager } from './services/store/balance-manager.js';
export { default as progressManager } from './services/store/progress-manager.js';
export {
  setupCacheHandlers,
  loadFromCache,
  clearCacheByTagsHandler
} from './services/store/cache-handlers.js';
export { setupSubscribers } from './services/store/subscribers.js';

// Експорт верифікаторів
export { VerificationCore } from './services/verification/core/verification-core.js';
export { BaseVerifier } from './services/verification/verifiers/base-verifier.js';
export { GenericVerifier } from './services/verification/verifiers/generic-verifier.js';
export { SocialVerifier } from './services/verification/verifiers/social-verifier.js';
export { LimitedVerifier } from './services/verification/verifiers/limited-verifier.js';
export { PartnerVerifier } from './services/verification/verifiers/partner-verifier.js';

// Експорт утиліт для роботи з DOM
export { default as domCore } from './utils/dom/core.js';
export { default as domEvents } from './utils/dom/events.js';
export { default as domAnimation } from './utils/dom/animation.js';

// Експорт утиліт для роботи з часом
export { default as dateUtils } from './utils/time/date.js';
export { default as formatUtils } from './utils/time/format.js';
export { default as timerUtils } from './utils/time/timer.js';

// Експорт утиліт для валідації
export { default as validationCore } from './utils/validation/core.js';
export { default as validationRules } from './utils/validation/rules.js';
export { default as validationForm } from './utils/validation/form.js';

// Експорт утиліт для роботи з даними
export { default as formatterUtils } from './utils/data/formatter.js';

// Експорт утиліт для кешування
export {
  getFromCache,
  saveToCache,
  removeFromCache,
  clearCacheByPattern,
  CACHE_KEYS,
  CACHE_TAGS
} from './utils/cache/cache-adapter.js';
export { default as cacheCore } from './utils/data/cache/core.js';
export { default as storageAdapter } from './utils/data/cache/storage.js';

// Експорт утиліт для сервісів
export { default as serviceFactory } from './utils/services/service-factory.js';

// Експорт утиліт для інтеграції та прогресу
export { default as syncService } from './services/progress/sync-service.js';
export {
  showLoadingIndicator,
  hideLoadingIndicator,
  showVerificationMessage,
  updateProgressUI
} from './utils/ui/loaders.js';

// Експорт сервісів інтеграції
export { ConflictResolver } from './services/integration/conflict-resolver.js';
export { DependencyManager } from './services/integration/dependency-manager.js';
export { DiagnosticsService } from './services/integration/diagnostics.js';
export { Initializer } from './services/integration/initializer.js';
export { UserProvider } from './services/integration/user-provider.js';

// Експорт логгера
export {
  getLogger,
  LOG_LEVELS,
  LOG_CATEGORIES,
  ERROR_LEVELS,
  ERROR_CATEGORIES
} from './utils/core/logger.js';

// Експорт контейнера залежностей
export { default as dependencyContainer } from './utils/core/dependency.js';

// Експорт UI компонентів
export { default as UIAnimations } from './ui/animations/core.js';
export { default as UIParticles } from './ui/animations/effects/particles.js';
export { default as UITransitions } from './ui/animations/effects/transitions.js';

// Експорт компонентів карток завдань
export { default as TaskCard } from './ui/components/card/base.js';
export { default as TaskCardActions } from './ui/components/card/actions.js';
export { default as TaskCardProgress } from './ui/components/card/progress.js';

// Експорт типів карток
export { default as LimitedTaskCard } from './ui/components/card/types/limited.js';
export { default as PartnerTaskCard } from './ui/components/card/types/partner.js';
export { default as SocialTaskCard } from './ui/components/card/types/social.js';

// Експорт анімацій винагород
export { default as RewardBadge } from './ui/components/reward/badge.js';
export { default as RewardPopup } from './ui/components/reward/popup.js';

// Експорт компонентів щоденного бонусу
export { default as DailyBonusCalendar } from './ui/components/daily-bonus/calendar.js';
export { default as DailyBonusDialog } from './ui/components/daily-bonus/dialog.js';
export { default as DailyBonusRewardPreview } from './ui/components/daily-bonus/reward-preview.js';

// Експорт компонентів сповіщень
export { default as Notifications } from './ui/notifications/toast.js';
export { default as ConfirmDialog } from './ui/notifications/dialog.js';
export { default as LoadingIndicator } from './ui/notifications/loading.js';

// Експорт компонентів прогресу
export { default as ProgressBar } from './ui/components/progress/bar.js';
export { default as ProgressCircle } from './ui/components/progress/circle.js';

// Експорт рендерерів завдань
export { default as RenderersFactory } from './ui/renderers/factory.js';
export { default as BaseRenderer } from './ui/renderers/base.js';
export { default as SocialRenderer } from './ui/renderers/types/social.js';
export { default as LimitedRenderer } from './ui/renderers/types/limited.js';
export { default as PartnerRenderer } from './ui/renderers/types/partner.js';

// Експорт модулів ініціалізації
export { default as TaskInitializer } from './initialization/initialization.js';
export { default as ModuleLoader } from './initialization/module-loader.js';
export { default as SystemMethods } from './initialization/system-methods.js';

// Ініціалізація основних компонентів при імпорті
import { getLogger } from './utils/core/logger.js';
import dailyBonusService from './services/daily-bonus/daily-bonus-service.js';
import { Initializer } from './initialization/initialization.js';
import * as moduleLoader from './initialization/module-loader.js';
import systemMethods from './initialization/system-methods.js';
import dependencyContainer from './utils/core/dependency.js';

// Імпорт API компонентів
import taskApi from './api/api.js';
import requestService from './api/core/request.js';
import cacheService from './api/core/cache.js';
import actionService from './api/services/action-service.js';
import taskService from './api/services/task-service.js';
import progressService from './api/services/progress-service.js';

// Імпорт сховища та менеджерів даних
import taskStore from './services/store/task-store.js';
import balanceManager from './services/store/balance-manager.js';
import progressManager from './services/store/progress-manager.js';
import { setupSubscribers } from './services/store/subscribers.js';
import { setupCacheHandlers } from './services/store/cache-handlers.js';

// Імпорт верифікаторів
import { VerificationCore } from './services/verification/core/verification-core.js';
import { setupCacheManager } from './services/verification/core/cache-manager.js';
import { setupErrorHandler } from './services/verification/core/error-handler.js';
import { setupEventDispatcher } from './services/verification/core/event-dispatcher.js';
import { setupTypeDetector } from './services/verification/core/type-detector.js';
import { setupUIController } from './services/verification/core/ui-controller.js';
import { GenericVerifier } from './services/verification/verifiers/generic-verifier.js';
import { SocialVerifier } from './services/verification/verifiers/social-verifier.js';
import { LimitedVerifier } from './services/verification/verifiers/limited-verifier.js';
import { PartnerVerifier } from './services/verification/verifiers/partner-verifier.js';

// Імпорт UI компонентів для ініціалізації
import UIAnimations from './ui/animations/core.js';
import ProgressBar from './ui/components/progress/bar.js';
import ProgressCircle from './ui/components/progress/circle.js';
import Notifications from './ui/notifications/toast.js';
import ConfirmDialog from './ui/notifications/dialog.js';
import LoadingIndicator from './ui/notifications/loading.js';
import RenderersFactory from './ui/renderers/factory.js';

// Створюємо логер для головного модуля
const logger = getLogger('TaskSystem');

// Основний об'єкт UI для зручного доступу
export const UI = {
  Animations: UIAnimations,
  ProgressBar,
  ProgressCircle,
  Notifications,
  ConfirmDialog,
  LoadingIndicator,

  // Метод для ініціалізації всіх UI компонентів
  initialize() {
    UIAnimations.init();
    ProgressBar.init();
    ProgressCircle.init();
    Notifications.init();
    ConfirmDialog.init();
    LoadingIndicator.init();

    logger.info('UI компоненти успішно ініціалізовано');
    return this;
  }
};

/**
 * Функція ініціалізації системи
 * @param {Object} options - Опції ініціалізації
 * @returns {Promise<boolean>} Результат ініціалізації
 */
export async function initializeTaskSystem(options = {}) {
  try {
    logger.info('Ініціалізація системи завдань');

    // Реєструємо основні модулі в контейнері залежностей
    registerCoreModules();

    // Ініціалізуємо UI компоненти
    UI.initialize();

    // Ініціалізуємо API
    taskApi.init(options.apiOptions || {});

    // Ініціалізуємо сховище та підписників
    await taskStore.initialize(options.storeOptions || {});
    setupSubscribers(taskStore);
    setupCacheHandlers(taskStore);

    // Ініціалізуємо менеджери даних
    balanceManager.initialize();
    progressManager.initialize();

    // Ініціалізуємо верифікацію
    const verificationCore = initializeVerification();

    // Ініціалізуємо сервіс щоденних бонусів
    await dailyBonusService.initialize();

    // Завантажуємо необхідні модулі
    const modules = await moduleLoader.loadModules();

    // Ініціалізуємо систему через Initializer
    const initializer = new Initializer();
    await initializer.init(options);

    // Реєструємо додаткові компоненти після ініціалізації
    registerRenderers();

    logger.info('Система завдань успішно ініціалізована');
    return true;
  } catch (error) {
    logger.error(error, 'Помилка ініціалізації системи завдань');
    return false;
  }
}

/**
 * Ініціалізація системи верифікації
 * @returns {VerificationCore} Ядро системи верифікації
 */
function initializeVerification() {
  try {
    // Створюємо ядро верифікації
    const verificationCore = new VerificationCore();

    // Ініціалізуємо ядро зі сховищем завдань
    verificationCore.initialize(taskStore);

    // Налаштовуємо компоненти верифікації
    setupCacheManager(verificationCore);
    setupErrorHandler();
    setupEventDispatcher(verificationCore);
    setupTypeDetector();
    setupUIController(verificationCore);

    // Реєструємо верифікатори
    verificationCore.registerVerifier('generic', new GenericVerifier());
    verificationCore.registerVerifier('social', new SocialVerifier());
    verificationCore.registerVerifier('limited', new LimitedVerifier());
    verificationCore.registerVerifier('partner', new PartnerVerifier());

    // Реєструємо ядро верифікації у контейнері залежностей
    dependencyContainer.register('verificationCore', verificationCore);

    logger.info('Система верифікації успішно ініціалізована');
    return verificationCore;
  } catch (error) {
    logger.error('Помилка ініціалізації системи верифікації:', error);
    return null;
  }
}

/**
 * Реєстрація ключових модулів в контейнері залежностей
 */
function registerCoreModules() {
  // Реєструємо ядро системи
  dependencyContainer.register('TaskSystem', TaskSystem);

  // Реєструємо UI компоненти
  dependencyContainer.register('UI', UI);
  dependencyContainer.register('UI.Animations', UIAnimations);
  dependencyContainer.register('UI.ProgressBar', ProgressBar);
  dependencyContainer.register('UI.ProgressCircle', ProgressCircle);
  dependencyContainer.register('UI.Notifications', Notifications);

  // Реєструємо API сервіси
  dependencyContainer.register('taskApi', taskApi);
  dependencyContainer.register('requestService', requestService);
  dependencyContainer.register('cacheService', cacheService);
  dependencyContainer.register('actionService', actionService);
  dependencyContainer.register('taskService', taskService);
  dependencyContainer.register('progressService', progressService);

  // Реєструємо сховище та менеджери
  dependencyContainer.register('taskStore', taskStore);
  dependencyContainer.register('balanceManager', balanceManager);
  dependencyContainer.register('progressManager', progressManager);

  // Реєструємо сервіси
  dependencyContainer.register('dailyBonusService', dailyBonusService);

  // Реєструємо рендерери
  dependencyContainer.register('RenderersFactory', RenderersFactory);

  logger.info('Ключові модулі зареєстровані в контейнері залежностей');
}

/**
 * Реєстрація рендерерів в фабриці
 */
function registerRenderers() {
  // Рендерери вже підключені через фабрику (RenderersFactory)
  // Але можемо додати додаткові якщо потрібно
  logger.info('Рендерери завдань зареєстровані');
}

// Основний об'єкт системи завдань
const TaskSystem = {
  initialize: initializeTaskSystem,
  dailyBonus: dailyBonusService,
  UI,
  api: taskApi,
  store: taskStore,

  // Додаємо методи з SystemMethods
  startTask: systemMethods.startTask,
  verifyTask: systemMethods.verifyTask,
  updateTaskProgress: systemMethods.updateTaskProgress,
  getTaskProgress: systemMethods.getTaskProgress,
  syncProgress: systemMethods.syncProgress,
  claimDailyBonus: systemMethods.claimDailyBonus,
  setActiveTab: systemMethods.setActiveTab,
  updateBalance: systemMethods.updateBalance,
  getSystemState: systemMethods.getSystemState,
  resetState: systemMethods.resetState,

  // Експортовані типи та конфігурації для зручного доступу
  types: {
    TASK_TYPES: TASK_TYPES,
    TASK_STATUS: TASK_STATUS,
    ACTION_TYPES: ACTION_TYPES,
    REWARD_TYPES: REWARD_TYPES,
    VERIFICATION_STATUS: VERIFICATION_STATUS,
    DAILY_BONUS_TYPES: DAILY_BONUS_TYPES
  },

  // Утиліти для роботи з UI
  ui: {
    showLoadingIndicator,
    hideLoadingIndicator,
    showVerificationMessage,
    updateProgressUI
  },

  // Модулі
  modules: {
    loadModules: moduleLoader.loadModules,
    getModuleCache: moduleLoader.getModuleCache,
    areModulesLoaded: moduleLoader.areModulesLoaded
  },

  // Моделі
  models: {
    TaskModel,
    LimitedTaskModel,
    PartnerTaskModel,
    SocialTaskModel,
    createDailyBonusModel
  },

  // Рендерери
  renderers: RenderersFactory,

  // Менеджери
  managers: {
    balanceManager,
    progressManager
  },

  // Верифікація
  verification: {
    verifyTask: (taskId) => {
      const verificationCore = dependencyContainer.resolve('verificationCore');
      if (verificationCore) {
        return verificationCore.verifyTask(taskId);
      }
      return Promise.reject(new Error('Ядро верифікації не ініціалізовано'));
    }
  }
};

// Встановлення глобальних об'єктів для можливості доступу з інших модулів
if (typeof window !== 'undefined') {
  window.TaskSystem = TaskSystem;
  window.UI = UI;
  window.taskApi = taskApi;
}

// Експорт за замовчуванням
export default TaskSystem;