/**
 * Центральний API модуль системи завдань
 *
 * Містить усі компоненти, пов'язані з API (Core, Models, Services)
 * для централізованого доступу без циклічних залежностей.
 *
 * @version 4.0.0
 */

// ======================== API CORE ========================
import CacheService from './core/cache.js';
import RequestService from './core/request.js';
import { CONFIG, API_VERSION, API_ERROR_CODES } from './core/config.js';

// ======================== API MODELS ========================
import { TaskTypesModel, TASK_TYPES, TASK_STATUSES, TASK_TYPE_PROPERTIES,
         VERIFICATION_ACTIONS, VERIFICATION_ACTION_PARAMS } from './models/task-types.js';
import { performBonusApiRequest, getDailyBonusStatus,
        claimDailyBonus, getDailyBonusHistory } from './models/daily-bonus-api.js';
import { convertServerToClientModel, convertClientToServerModel,
        convertServerHistory, createDefaultModel, processClaimResponse } from './models/daily-bonus-converters.js';
import { createDailyBonusModel } from './models/daily-bonus-model.js';

// ======================== API SERVICES ========================
import ActionService from './services/action-service.js';
import TaskService from './services/task-service.js';
import ProgressService from './services/progress-service.js';

// Створюємо екземпляри основних сервісів
const cacheService = new CacheService();
const requestService = new RequestService().init();
const actionService = new ActionService();
const taskService = new TaskService();
const progressService = new ProgressService();

// API для щоденних бонусів
const dailyBonusApi = {
  getDailyBonusStatus,
  claimDailyBonus,
  getDailyBonusHistory
};

// Головний об'єкт API
const taskApi = {
  // Версія API
  version: API_VERSION,

  // Конфігурація
  config: CONFIG,
  errorCodes: API_ERROR_CODES,

  // Базові сервіси
  cache: cacheService,
  request: requestService,
  action: actionService,
  task: taskService,
  progress: progressService,

  // API моделей
  models: {
    TASK_TYPES,
    TASK_STATUSES,
    TASK_TYPE_PROPERTIES,
    VERIFICATION_ACTIONS,
    VERIFICATION_ACTION_PARAMS
  },

  // API щоденних бонусів
  dailyBonus: dailyBonusApi,

  // Методи ініціалізації
  init: function(options) {
    console.log(`🔄 Task API: Ініціалізація модуля завдань v${this.version}`);

    // Можемо оновити конфігурацію, якщо потрібно
    if (options && options.apiPaths) {
      Object.assign(CONFIG.API_PATHS, options.apiPaths);
    }

    // Генеруємо подію ініціалізації
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent('task-api-initialized', {
          detail: {
            timestamp: Date.now(),
            version: this.version,
          },
        })
      );
    }

    this._initialized = true;
    return this;
  },

  // Методи зручного доступу
  getUserId: function() {
    return requestService.getUserId();
  },

  clearCache: function() {
    cacheService.clearCache();
    console.log('✓ Task API: Кеш очищено');
  },

  // Зручні методи для роботи з завданнями
  getAllTasks: function(options) {
    return taskService.loadAllTasks(options);
  },

  // Методи щоденного бонусу
  getDailyBonusStatus: function(userId) {
    return dailyBonusApi.getDailyBonusStatus(userId);
  },

  claimDailyBonus: function(userId) {
    return dailyBonusApi.claimDailyBonus(userId);
  }
};

// Для зручної інтеграції
export {
  cacheService,
  requestService,
  actionService,
  taskService,
  progressService,
  dailyBonusApi,
  CONFIG,
  API_VERSION,
  API_ERROR_CODES,
  TASK_TYPES,
  TASK_STATUSES,
  VERIFICATION_ACTIONS,
  VERIFICATION_ACTION_PARAMS
};

// Експорт за замовчуванням
export default taskApi;