/**
 * Головний модуль для щоденних бонусів
 *
 * Відповідає за:
 * - Експорт всіх необхідних функцій для роботи з щоденними бонусами
 * - Збереження зворотної сумісності з іншими модулями
 */

// Імпорт моделі даних напряму без повторного експорту
import createDailyBonusModel from './daily-bonus-model.js';

// Імпорт конвертерів напряму без деструктуризації для уникнення циклічних залежностей
import * as bonusConverters from './daily-bonus-converters.js';

// Імпорт API методів напряму без деструктуризації для уникнення циклічних залежностей
import * as bonusApi from './daily-bonus-api.js';

// Отримання конкретних функцій з імпортованих модулів
const convertServerToClientModel = bonusConverters.convertServerToClientModel;
const convertClientToServerModel = bonusConverters.convertClientToServerModel;
const processClaimResponse = bonusConverters.processClaimResponse;
const createDefaultModel = bonusConverters.createDefaultModel;

const performBonusApiRequest = bonusApi.performBonusApiRequest;
const getDailyBonusStatus = bonusApi.getDailyBonusStatus;
const claimDailyBonus = bonusApi.claimDailyBonus;
const getDailyBonusHistory = bonusApi.getDailyBonusHistory;

// Реекспорт функцій для підтримки існуючого коду
export {
  createDailyBonusModel,
  convertServerToClientModel,
  convertClientToServerModel,
  processClaimResponse,
  createDefaultModel,
  performBonusApiRequest,
  getDailyBonusStatus,
  claimDailyBonus,
  getDailyBonusHistory,
};

// Створення публічного API для модуля
const dailyBonusApi = {
  getDailyBonusStatus,
  claimDailyBonus,
  getDailyBonusHistory,
  convertServerToClientModel,
  convertClientToServerModel,
  createDefaultModel,
  createDailyBonusModel
};

// Реєстрація в глобальному об'єкті, якщо він існує
if (typeof window !== 'undefined') {
  // Створюємо глобальний реєстр модулів, якщо його ще немає
  window.ModuleRegistry = window.ModuleRegistry || {
    modules: {},
    register: function(name, module) {
      this.modules[name] = module;
    },
    get: function(name) {
      return this.modules[name] || null;
    }
  };

  // Реєструємо наш модуль
  window.ModuleRegistry.register('dailyBonusApi', dailyBonusApi);

  // Також робимо його доступним напряму в глобальному просторі для зворотної сумісності
  window.dailyBonusApi = dailyBonusApi;
}

// Експорт за замовчуванням
export default dailyBonusApi;