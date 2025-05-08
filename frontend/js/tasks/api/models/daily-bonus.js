/**
 * Головний модуль для щоденних бонусів
 *
 * Відповідає за:
 * - Експорт всіх необхідних функцій для роботи з щоденними бонусами
 * - Збереження зворотної сумісності з іншими модулями
 */

// Імпорт моделі даних
import createDailyBonusModel from './daily-bonus-model.js';

// Імпорт конвертерів
import {
  convertServerToClientModel,
  convertClientToServerModel,
  processClaimResponse,
  createDefaultModel,
} from './daily-bonus-converters.js';

// Імпорт API методів
import {
  performBonusApiRequest,
  getDailyBonusStatus,
  claimDailyBonus,
  getDailyBonusHistory,
} from './daily-bonus-api.js';

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

// Створення та експорт публічного API для модуля
const dailyBonusApi = {
  getDailyBonusStatus,
  claimDailyBonus,
  getDailyBonusHistory,
  convertServerToClientModel,
  convertClientToServerModel,
  createDefaultModel,
  createDailyBonusModel
};

// Якщо потрібно реєструвати в глобальному об'єкті (опційно)
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register('dailyBonusApi', dailyBonusApi);
}

// Експорт за замовчуванням
export default dailyBonusApi;