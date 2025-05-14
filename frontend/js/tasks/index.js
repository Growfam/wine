/**
 * Точка входу системи завдань WINIX
 *
 * Єдина точка імпорту для всієї системи завдань.
 * Уникає індексних файлів у підмодулях для запобігання циклічним залежностям.
 *
 * @version 4.0.0
 */

// ================================================================
// ІМПОРТ API (все API в одному файлі)
// ================================================================
import taskApi, {
  cacheService, requestService, actionService, taskService, progressService,
  dailyBonusApi, CONFIG as API_CONFIG, API_VERSION, API_ERROR_CODES,
  TASK_TYPES, TASK_STATUSES, VERIFICATION_ACTIONS, VERIFICATION_ACTION_PARAMS
} from './api/api.js';

// ================================================================
// ПРЯМІ ІМПОРТИ КОНФІГУРАЦІЇ
// ================================================================
import { CONFIG as SystemConfig } from './config/settings.js';
import { ACTION_TYPES } from 'config/action-types.js';
import { DAILY_BONUS_TYPES, DAILY_BONUS_CONFIG } from 'config/daily-bonus-types.js';
import { REWARD_TYPES } from 'config/reward-types.js';
import { SOCIAL_NETWORKS } from 'config/social-networks.js';
import { TASK_STATUS } from 'config/status-types.js';
import { VERIFICATION_STATUS } from 'config/verification-status.js';

// ================================================================
// ПРЯМІ ІМПОРТИ ІНІЦІАЛІЗАЦІЇ
// ================================================================
import { Initializer } from './initialization/initialization.js';
import {
  loadModules, getModuleCache, areModulesLoaded, clearModuleCache
} from './initialization/module-loader.js';
import {
  getTasks, findTaskById, startTask, verifyTask, updateTaskProgress,
  getTaskProgress, syncProgress, claimDailyBonusFn, setActiveTab,
  updateBalance, getSystemState, resetState, dispatchSystemEvent
} from './initialization/system-methods.js';

// ================================================================
// ПРЯМІ ІМПОРТИ МОДЕЛЕЙ
// ================================================================
// Базові моделі
import { TaskModel } from './models/base/task-model.js';
import {
  validateRequiredFields, validateDates, validatePartnerData,
  validateSocialData, isValidTask
} from './models/base/validators.js';
import { formatToApiData, formatToDisplayData } from './models/base/formatters.js';
import { generateTrackingUrl, hasTrackingParams, removeTrackingParams } from './models/base/tracking.js';

// Типи моделей
import { DailyBonusModel, createDailyBonusModel } from './models/types/daily-bonus-model.js';
import { LimitedTaskModel } from './models/types/limited-task-model.js';
import { PartnerTaskModel } from './models/types/partner-task-model.js';
import { SocialTaskModel } from './models/types/social-task-model.js';

// ================================================================
// ПРЯМІ ІМПОРТИ СЕРВІСІВ
// ================================================================
// Щоденний бонус
import { DailyBonusCacheHandler } from './services/daily-bonus/cache-handler.js';
import DailyBonusService from './services/daily-bonus/daily-bonus-service.js';

// Інтеграція
import { ConflictResolver } from './services/integration/conflict-resolver.js';
import { DependencyManager } from './services/integration/dependency-manager.js';
import { DiagnosticsService } from './services/integration/diagnostics.js';
import { UserProvider } from './services/integration/user-provider.js';

// Прогрес
import TaskProgress from './services/progress/task-progress.js';
import { setupUIUpdater } from './services/progress/ui-updater.js';
import { setupSyncService, syncTaskProgress, syncAllProgress } from './services/progress/sync-service.js';

// Сховище
import { TaskStore } from './services/store/task-store.js';
import { BalanceManager } from './services/store/balance-manager.js';
import { ProgressManager } from './services/store/progress-manager.js';
import { setupCacheHandlers, loadFromCache, clearCacheByTagsHandler } from './services/store/cache-handlers.js';
import { setupSubscribers } from './services/store/subscribers.js';

// Верифікація
import { VerificationCore } from './services/verification/core/verification-core.js';
import { setupCacheManager } from './services/verification/core/cache-manager.js';
import { setupErrorHandler } from './services/verification/core/error-handler.js';
import { setupEventDispatcher } from './services/verification/core/event-dispatcher.js';
import { setupTypeDetector } from './services/verification/core/type-detector.js';
import { setupUIController } from './services/verification/core/ui-controller.js';
import { BaseVerifier } from './services/verification/verifiers/base-verifier.js';
import { GenericVerifier } from './services/verification/verifiers/generic-verifier.js';
import { LimitedVerifier } from './services/verification/verifiers/limited-verifier.js';
import { PartnerVerifier } from './services/verification/verifiers/partner-verifier.js';
import { SocialVerifier } from './services/verification/verifiers/social-verifier.js';
import { setupUIHandlers, showVerificationLoader, hideVerificationLoader } from './services/verification/ui/loaders.js';

// ================================================================
// ПРЯМІ ІМПОРТИ UI
// ================================================================
// Анімації
import {
  init as initAnimations, setPerformanceMode, getConfig as getAnimationConfig,
  getState as getAnimationState, state as animationsState, config as animationsConfig
} from './ui/animations/core.js';
import {
  createSuccessParticles, createConfetti, createStarsEffect, createEmojiRain
} from './ui/animations/effects/particles.js';
import {
  highlightElement, pulseElement, createRippleEffect, fadeIn, fadeOut,
  animateSequence, animateNumber, animateTextChange
} from './ui/animations/effects/transitions.js';
import {
  animateCurrentDay, animateTokenDay, animateDayTransition,
  animateDailyBonusClaim, animateCycleCompletion
} from './ui/animations/reward/daily-bonus.js';
import {
  showReward, showDailyBonusReward, showCycleCompletionAnimation,
  updateUserBalance, animateTokenDay as animateTokenDayReward
} from './ui/animations/reward/display.js';
import {
  animateTaskCompletion, animateTaskError, animateTaskExpiration, animateTaskStart
} from './ui/animations/task/completion.js';
import {
  animateSuccessfulCompletion, showProgressAnimation, animateTaskStatusChange,
  animateTasksAppear, animateTasksFiltering
} from './ui/animations/task/progress.js';

// Компоненти: Картки
import {
  create as createCard, updateStatus, escapeHtml, getTaskElementById, isTaskRendered,
  updateTaskTitle, updateTaskDescription
} from './ui/components/card/base.js';
import {
  init as initCardActions, setupActionButtons, handleStartTask,
  handleVerifyTask, updateActionStatus
} from './ui/components/card/actions.js';
import {
  init as initCardProgress, render as renderProgressBar, updateProgress as updateCardProgress,
  getProgressElement, updateAllProgress, cleanup as cleanupCardProgress
} from './ui/components/card/progress.js';
import { create as createLimitedCard } from './ui/components/card/types/limited.js';
import {
  create as createPartnerCard, isUrlSafe, generateCsrfToken,
  ALLOWED_DOMAINS, BLOCKED_SCHEMES
} from './ui/components/card/types/partner.js';
import {
  create as createSocialCard, detectNetworkType, SOCIAL_NETWORKS as UI_SOCIAL_NETWORKS
} from './ui/components/card/types/social.js';

// Компоненти: Щоденний бонус
import { DailyBonusCalendar } from './ui/components/daily-bonus/calendar.js';
import { DailyBonusDialog } from './ui/components/daily-bonus/dialog.js';
import { DailyBonusRewardPreview } from './ui/components/daily-bonus/reward-preview.js';

// Компоненти: Прогрес
import {
  init as initProgressBar, createProgressBar, updateProgress, getProgress,
  getAllProgressBars, removeProgressBar, cleanup as cleanupProgressBar, deactivate
} from './ui/components/progress/bar.js';
import {
  init as initProgressCircle, createProgressCircle, updateProgress as updateProgressCircle,
  getProgress as getProgressCircle, getAllProgressCircles, removeProgressCircle,
  cleanup as cleanupProgressCircle, deactivate as deactivateCircle
} from './ui/components/progress/circle.js';

// Компоненти: Винагорода
import {
  create as createRewardBadge, showAnimation as showRewardAnimation,
  formatNumber, getCoinsLabel
} from './ui/components/reward/badge.js';
import {
  showRewardPopup, showRewardSequence
} from './ui/components/reward/popup.js';

// Сповіщення
import {
  CONFIG as NotificationConfig, injectStyles, ensureContainer, updateConfig as updateNotificationConfig
} from './ui/notifications/common.js';
import {
  init as initDialog, showConfirmDialog, hideAllDialogs, cleanup as cleanupDialog
} from './ui/notifications/dialog.js';
import {
  init as initNotifications, cleanup as cleanupNotifications, showInfo, showSuccess,
  showError, showWarning, showNotification, updateBalanceUI
} from './ui/notifications/index.js';
import {
  init as initLoading, showLoading, hideLoading, cleanup as cleanupLoading
} from './ui/notifications/loading.js';
import {
  init as initToast, showInfo as showInfoToast, showSuccess as showSuccessToast,
  showError as showErrorToast, showWarning as showWarningToast, showNotification as showToastNotification,
  updateBalanceUI as updateBalanceToast, cleanup as cleanupToast
} from './ui/notifications/toast.js';

// Рендерери
import { BaseRenderer, TASK_STATUS as RENDERER_TASK_STATUS } from './ui/renderers/base.js';
import {
  getRendererByType, renderTask, refreshTaskDisplay, refreshAllTasks, registerRenderer
} from './ui/renderers/factory.js';
import { Limited as LimitedRenderer } from './ui/renderers/types/limited.js';
import {
  Partner as PartnerRenderer, ALLOWED_DOMAINS as RENDERER_ALLOWED_DOMAINS,
  BLOCKED_SCHEMES as RENDERER_BLOCKED_SCHEMES, generateCsrfToken as rendererGenerateCsrfToken,
  isUrlSafe as rendererIsUrlSafe
} from './ui/renderers/types/partner.js';
import {
  Social as SocialRenderer, SOCIAL_NETWORKS as RENDERER_SOCIAL_NETWORKS,
  SUPPORTED_NETWORKS, detectNetworkType as rendererDetectNetworkType,
  getSocialIcon, isUrlSafe as socialIsUrlSafe, escapeHTML
} from './ui/renderers/types/social.js';

// ================================================================
// ПРЯМІ ІМПОРТИ УТИЛІТ (ВСІ ФАЙЛИ З ДИРЕКТОРІЇ utils/)
// ================================================================
// Кешування
import {
  CACHE_KEYS, CACHE_TAGS, getFromCache, saveToCache, removeFromCache,
  clearCacheByPattern, cacheTaskType, getCachedTaskType, cacheVerificationResult,
  getCachedVerificationResult, clearVerificationCache, loadProgressFromCache, clearCacheByTags
} from './utils/cache/cache-adapter.js';

// Ядро
import { getLogger, LOG_CATEGORIES, LOG_LEVELS } from './utils/core/logger.js';
import dependencyContainer, { DependencyContainer } from './utils/core/dependency.js';

// Дані
import {
  formatNumber as dataFormatNumber, formatCurrency, formatText, formatDateForApi,
  formatJson, formatFileSize, prepareDataForApi, processApiResponse,
  configureApiFormatter, detectFieldType, parseDate as dataParseDate
} from './utils/data/formatter.js';
import {
  STORAGE_TYPES, StorageAdapter, storageCompat
} from './utils/data/cache/storage.js';
import {
  CACHE_TAGS as dataCacheTags
} from './utils/data/cache/core.js';

// DOM
import {
  createFromHTML, escapeHTML as domEscapeHTML, getElementPosition, scrollToElement,
  isElementInViewport, loadImage, addClass, removeClass, hasClass, toggleClass,
  findParent, createElement
} from './utils/dom/core.js';
import {
  addEvent, removeEvent, removeAllEvents, delegateEvent, removeDelegatedEvent,
  onDOMReady, debounce, throttle, triggerEvent
} from './utils/dom/events.js';
import {
  fadeIn as domFadeIn, fadeOut as domFadeOut, slideDown, slideUp,
  animate, addKeyframes, stopAnimations, transition
} from './utils/dom/animation.js';

// Час
import {
  parseDate, isValidDate, isLeapYear, formatDateForApi as timeFormatDateForApi,
  parseApiDate, getDateDifference, addPeriod, subtractPeriod, getUserTimezone,
  isDateInRange, getMonthDay
} from './utils/time/date.js';
import {
  formatDate, getRelativeTimeString, pluralize, formatTimeLeft,
  formatDuration, parseIsoDuration, formatIsoDuration
} from './utils/time/format.js';
import {
  init as initTimers, cleanup as cleanupTimers, createCountdown, stopCountdown,
  stopAllCountdowns, getTimeLeft, isExpired, calculateUpdateFrequency, createSimpleCountdown
} from './utils/time/timer.js';

// Валідація
import {
  validate, validateRequired, validatePattern, validateLength, validateEmail,
  validatePhone, validateUrl, validateNumber, validateInteger, validateMatch,
  validatePassword, validateCheckbox, validateDate, regexCache
} from './utils/validation/core.js';
import {
  validateUsername, validatePersonName, validateEmailExtended, validateNistPassword,
  validateCreditCard, validateDateExtended, validateFile, validateAddress, validatePhoneExtended
} from './utils/validation/rules.js';
import {
  init as initFormValidation, cleanup as cleanupFormValidation, setupFormValidation,
  validateForm, validateField, updateConfig as updateFormConfig
} from './utils/validation/form.js';

// Сервіси
import serviceFactory from './utils/services/service-factory.js';

// UI утиліти
import {
  showLoadingIndicator, hideLoadingIndicator, showVerificationMessage,
  updateProgressUI, showVerificationLoader as uiShowVerificationLoader,
  hideVerificationLoader as uiHideVerificationLoader
} from './utils/ui/loaders.js';

// ================================================================
// СТВОРЕННЯ ЕКЗЕМПЛЯРІВ ОСНОВНИХ КОМПОНЕНТІВ
// ================================================================

// Створюємо логер для основної системи
const logger = getLogger('TaskSystem');

// Створюємо екземпляри необхідних сервісів
const taskStore = new TaskStore();
const dailyBonusService = new DailyBonusService();
const initializer = new Initializer();

// Визначення версії
const VERSION = '4.0.0';

// ================================================================
// МОДИФІКАЦІЯ СИСТЕМИ ІНІЦІАЛІЗАЦІЇ
// ================================================================

/**
 * Асинхронна функція для ініціалізації контейнера залежностей
 * @returns {Promise<Object>} Проміс, що повертає контейнер залежностей
 */
export async function initializeDependencies() {
  try {
    logger.info('Ініціалізація контейнера залежностей');

    // Реєструємо TaskManager і TaskSystem у контейнері
    registerTaskSystemInContainer();

    return dependencyContainer;
  } catch (e) {
    logger.error('Помилка завантаження DependencyContainer:', e);
    throw e;
  }
}

/**
 * Функція для реєстрації системи завдань у контейнері залежностей
 */
function registerTaskSystemInContainer() {
  if (!dependencyContainer || typeof dependencyContainer.register !== 'function') {
    logger.error('DependencyContainer не ініціалізований або не має методу register');
    return;
  }

  try {
    // Реєструємо TaskManager у контейнері залежностей
    if (window.TaskManager) {
      dependencyContainer.register('TaskManager', window.TaskManager);
      logger.info('TaskManager зареєстровано в контейнері залежностей');
    }

    // Реєструємо TaskSystem у контейнері залежностей
    if (window.WINIX && window.WINIX.tasks) {
      dependencyContainer.register('TaskSystem', window.WINIX.tasks);
      logger.info('TaskSystem зареєстровано в контейнері залежностей');
    }

    // Реєструємо сервіси
    dependencyContainer.register('cacheService', cacheService);
    dependencyContainer.register('requestService', requestService);
    dependencyContainer.register('taskService', taskService);
    dependencyContainer.register('actionService', actionService);
    dependencyContainer.register('progressService', progressService);
    dependencyContainer.register('taskStore', taskStore);
    dependencyContainer.register('dailyBonusService', dailyBonusService);

  } catch (e) {
    logger.error('Помилка реєстрації систем у контейнері залежностей:', e);
  }
}

// ================================================================
// МОДИФІКОВАНИЙ ІНІЦІАЛІЗАТОР СИСТЕМИ
// ================================================================

/**
 * Ініціалізація системи завдань
 * @param {Object} options Опції ініціалізації
 * @returns {Promise<boolean>} Результат ініціалізації
 */
async function initializeSystem(options = {}) {
  try {
    logger.info('Ініціалізація системи завдань', options);

    // Ініціалізуємо API
    taskApi.init(options);

    // Ініціалізуємо залежності
    await initializeDependencies();

    // Ініціалізуємо підсистеми
    const uiOptions = options.ui || {};

    // Ініціалізуємо анімації
    if (uiOptions.animations) {
      initAnimations(uiOptions.animations);
    }

    // Ініціалізуємо сповіщення
    initNotifications();

    // Ініціалізуємо сховище
    taskStore.initialize();

    // Ініціалізуємо прогрес
    TaskProgress.prototype.initialize();

    // Ініціалізуємо щоденні бонуси
    dailyBonusService.initialize();

    // Завантажуємо завдання, якщо потрібно
    if (options.loadTasks !== false) {
      await taskService.loadAllTasks({ forceRefresh: options.forceRefresh });
    }

    logger.info('Систему завдань успішно ініціалізовано');

    // Генеруємо подію про ініціалізацію
    dispatchSystemEvent('system-initialized', {
      timestamp: Date.now(),
      version: VERSION
    });

    return true;
  } catch (error) {
    logger.error('Помилка ініціалізації системи завдань:', error);
    return false;
  }
}

// ================================================================
// СТВОРЕННЯ ПУБЛІЧНОГО API
// ================================================================

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
  claimDailyBonus: claimDailyBonusFn,

  // Методи роботи з UI та станом
  setActiveTab,
  updateBalance,
  getSystemState,
  resetState,
  dispatchSystemEvent,

  // Доступ до ключових компонентів
  api: taskApi,

  // Доступ до основних моделей
  models: {
    TaskModel,
    LimitedTaskModel,
    PartnerTaskModel,
    SocialTaskModel,
    DailyBonusModel,
    createTaskModel: function(type, data = {}) {
      switch (type) {
        case TASK_TYPES.SOCIAL:
          return new SocialTaskModel(data);
        case TASK_TYPES.LIMITED:
          return new LimitedTaskModel(data);
        case TASK_TYPES.PARTNER:
          return new PartnerTaskModel(data);
        case TASK_TYPES.REFERRAL:
          return new SocialTaskModel(data);
        default:
          return new TaskModel(data);
      }
    },
    createDailyBonusModel
  },

  // Доступ до сервісів
  services: {
    store: taskStore,
    dailyBonus: dailyBonusService,
    verification: {
      verifyTask: verifyTask,
      showLoader: showVerificationLoader,
      hideLoader: hideVerificationLoader
    }
  },

  // Доступ до UI компонентів
  ui: {
    animations: {
      init: initAnimations,
      setPerformanceMode,
      effects: {
        createSuccessParticles,
        createConfetti,
        createStarsEffect,
        pulseElement,
        highlightElement,
        fadeIn,
        fadeOut
      }
    },
    components: {
      card: {
        create: createCard,
        updateStatus,
        createLimitedCard,
        createPartnerCard,
        createSocialCard
      },
      progress: {
        createProgressBar,
        updateProgress,
        createProgressCircle
      },
      reward: {
        createRewardBadge,
        showRewardAnimation,
        showRewardPopup
      },
      dailyBonus: {
        Calendar: DailyBonusCalendar,
        Dialog: DailyBonusDialog,
        RewardPreview: DailyBonusRewardPreview
      }
    },
    notifications: {
      showSuccess,
      showError,
      showInfo,
      showWarning,
      showConfirmDialog,
      showLoading,
      hideLoading,
      updateBalanceUI
    },
    renderers: {
      renderTask,
      refreshTaskDisplay,
      refreshAllTasks
    }
  },

  // Доступ до утиліт
  utils: {
    logger: {
      getLogger,
      LOG_CATEGORIES,
      LOG_LEVELS
    },
    dependency: dependencyContainer,
    data: {
      formatNumber: dataFormatNumber,
      formatCurrency,
      formatText,
      parseDate: dataParseDate
    },
    dom: {
      addClass,
      removeClass,
      hasClass,
      addEvent,
      removeEvent,
      onDOMReady,
      debounce,
      throttle
    },
    time: {
      formatDate,
      getRelativeTimeString,
      parseDate,
      isValidDate,
      formatDuration
    },
    validation: {
      validate,
      validateEmail,
      validatePhone,
      validateUrl
    },
    services: serviceFactory
  },

  // Ключові типи та константи
  types: {
    TASK_TYPES,
    TASK_STATUSES,
    TASK_STATUS,
    ACTION_TYPES,
    REWARD_TYPES,
    SOCIAL_NETWORKS,
    VERIFICATION_STATUS,
    DAILY_BONUS_TYPES
  },

  // Конфігурація
  config: SystemConfig
};

// ================================================================
// АВТОІНІЦІАЛІЗАЦІЯ ТА ГЛОБАЛЬНІ ОБ'ЄКТИ
// ================================================================

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
  claimDailyBonus: claimDailyBonusFn,

  // Додаткові методи
  diagnoseSystemState: getSystemState,
  refreshAllTasks: () => initializeSystem({ forceRefresh: true }),
  showErrorMessage: (message) => {
    console.error(message);
    return false;
  },
  showSuccessMessage: (message) => {
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
  REWARD_TYPES: REWARD_TYPES,
};

// Для використання в сучасному синтаксисі
window.WINIX = window.WINIX || {};
window.WINIX.tasks = taskSystem;

// Експортуємо для використання в модулях
export default taskSystem;

// Експортуємо ключові компоненти для розширеного використання
export {
  taskApi,
  cacheService,
  requestService,
  taskService,
  actionService,
  progressService,
  taskStore,
  dailyBonusService
};

// Експортуємо dependencyContainer для підтримки інших модулів
export { dependencyContainer };