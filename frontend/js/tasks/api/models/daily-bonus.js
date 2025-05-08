// Файл: frontend/js/tasks/api/models/daily-bonus.js

/**
 * Api моделі для щоденних бонусів
 *
 * Відповідає за:
 * - Конвертацію серверних моделей в клієнтські
 * - Підготовку даних для відправки на сервер
 */

// Імпортуємо залежності явно замість використання глобальних об'єктів
import { getLogger } from '../../utils/core/logger.js';
import { DAILY_BONUS_TYPES } from '../../config/types/daily-bonus-types.js';

// Створюємо логер для модуля
const logger = getLogger('DailyBonusModel');

// Функція логування з використанням логера
function logMessage(level, message, source = '', details = {}) {
  try {
    logger[level](message, source, details);
  } catch (e) {
    console.error('Помилка при логуванні:', e);
  }
}

// Функція для створення моделі бонусу
function createDailyBonusModel(data = {}) {
  try {
    const now = Date.now();

    return {
      userId: data.userId || null,
      status: data.status || DAILY_BONUS_TYPES.STATUS.AVAILABLE,
      currentDay: data.currentDay || 1,
      totalDays: data.totalDays || 0,
      completedCycles: data.completedCycles || 0,
      timestamps: {
        lastClaimed: data.timestamps?.lastClaimed || null,
        nextAvailable: data.timestamps?.nextAvailable || null,
        lastUpdated: now,
      },
      history: data.history || [],
      checkAvailability: function() {
        const now = Date.now();
        // Базова перевірка доступності
        if (this.status === DAILY_BONUS_TYPES.STATUS.CLAIMED &&
            this.timestamps.nextAvailable && now >= this.timestamps.nextAvailable) {
          return {
            available: true,
            status: DAILY_BONUS_TYPES.STATUS.AVAILABLE,
            nextTime: null,
            reason: 'RESET_TIME_PASSED',
          };
        }

        if (this.status === DAILY_BONUS_TYPES.STATUS.AVAILABLE) {
          return {
            available: true,
            status: DAILY_BONUS_TYPES.STATUS.AVAILABLE,
            nextTime: null,
            reason: 'AVAILABLE',
          };
        }

        return {
          available: false,
          status: this.status,
          nextTime: this.timestamps.nextAvailable,
          reason: 'UNAVAILABLE',
        };
      },
      calculateReward: function() {
        // Базовий розрахунок нагороди
        const baseTokens = 5;
        const multiplier = 1 + (this.currentDay * 0.1);
        return {
          tokens: baseTokens * multiplier,
          coins: this.currentDay >= 5 ? Math.floor(this.currentDay / 2) : 0,
          isSpecialDay: this.currentDay % 5 === 0
        };
      }
    };
  } catch (e) {
    logMessage('error', 'Помилка створення моделі бонусу', 'createDailyBonusModel', { error: e });
    // Повертаємо базову модель при помилці
    return {
      userId: data.userId || null,
      status: 'error',
      error: e.message,
      checkAvailability: () => ({ available: false, status: 'error', reason: 'ERROR' }),
      calculateReward: () => ({ tokens: 0, coins: 0, isSpecialDay: false })
    };
  }
}

/**
 * Конвертація серверної моделі в клієнтську
 * @param {Object} serverModel - Серверна модель
 * @param {string} userId - ID користувача
 * @returns {Object} Клієнтська модель
 */
function convertServerToClientModel(serverModel, userId) {
  try {
    if (!serverModel) {
      logMessage('warn', 'Отримано порожню серверну модель', 'convertServerToClientModel');
      return createDefaultModel(userId);
    }

    // Конвертуємо статус
    const statusMap = {
      available: DAILY_BONUS_TYPES.STATUS.AVAILABLE,
      claimed: DAILY_BONUS_TYPES.STATUS.CLAIMED,
      expired: DAILY_BONUS_TYPES.STATUS.EXPIRED,
      pending: DAILY_BONUS_TYPES.STATUS.PENDING,
      locked: DAILY_BONUS_TYPES.STATUS.LOCKED,
    };

    const status = statusMap[serverModel.status] || DAILY_BONUS_TYPES.STATUS.PENDING;

    // Парсимо часові мітки
    const lastClaimed = serverModel.last_claimed_at
      ? new Date(serverModel.last_claimed_at).getTime()
      : null;

    const nextAvailable = serverModel.next_available_at
      ? new Date(serverModel.next_available_at).getTime()
      : null;

    // Створюємо клієнтську модель
    const clientModel = {
      userId: userId,
      status: status,
      currentDay: serverModel.current_day || 1,
      totalDays: serverModel.total_days || 0,
      completedCycles: serverModel.completed_cycles || 0,
      timestamps: {
        lastClaimed: lastClaimed,
        nextAvailable: nextAvailable,
        lastUpdated: Date.now(),
      },
      history: convertServerHistory(serverModel.history),
    };

    logMessage('debug', 'Серверна модель успішно конвертована', 'convertServerToClientModel');

    return createDailyBonusModel(clientModel);
  } catch (error) {
    logMessage('error', 'Помилка конвертації серверної моделі', '', { error });
    return createDefaultModel(userId);
  }
}

/**
 * Конвертація клієнтської моделі для відправки на сервер
 * @param {Object} clientModel - Клієнтська модель
 * @returns {Object} Дані для відправки на сервер
 */
function convertClientToServerModel(clientModel) {
  try {
    if (!clientModel) {
      logMessage('warn', 'Отримано порожню клієнтську модель', 'convertClientToServerModel');
      return null;
    }

    // Конвертуємо статус
    const statusMap = {
      [DAILY_BONUS_TYPES.STATUS.AVAILABLE]: 'available',
      [DAILY_BONUS_TYPES.STATUS.CLAIMED]: 'claimed',
      [DAILY_BONUS_TYPES.STATUS.EXPIRED]: 'expired',
      [DAILY_BONUS_TYPES.STATUS.PENDING]: 'pending',
      [DAILY_BONUS_TYPES.STATUS.LOCKED]: 'locked',
    };

    const status = statusMap[clientModel.status] || 'pending';

    // Створюємо серверну модель
    const serverModel = {
      user_id: clientModel.userId,
      status: status,
      current_day: clientModel.currentDay,
      total_days: clientModel.totalDays,
      completed_cycles: clientModel.completedCycles,
    };

    logMessage('debug', 'Клієнтська модель успішно конвертована для сервера', 'convertClientToServerModel');

    return serverModel;
  } catch (error) {
    logMessage('error', 'Помилка конвертації клієнтської моделі для сервера', '', { error });
    return null;
  }
}

/**
 * Конвертація історії з серверної моделі
 * @param {Array} serverHistory - Історія з серверної моделі
 * @returns {Array} Історія для клієнтської моделі
 */
function convertServerHistory(serverHistory) {
  if (!serverHistory || !Array.isArray(serverHistory)) {
    return [];
  }

  try {
    return serverHistory.map((entry) => {
      return {
        day: entry.day || 1,
        cycle: entry.cycle || 0,
        timestamp: entry.claimed_at ? new Date(entry.claimed_at).getTime() : Date.now(),
        reward: {
          tokens: entry.reward?.tokens || 0,
          coins: entry.reward?.coins || 0,
          isSpecialDay: !!entry.reward?.is_special_day,
        },
      };
    });
  } catch (error) {
    logMessage('error', 'Помилка конвертації історії', '', { error });
    return [];
  }
}

/**
 * Створення моделі за замовчуванням
 * @param {string} userId - ID користувача
 * @returns {Object} Модель за замовчуванням
 */
function createDefaultModel(userId) {
  const now = Date.now();

  const defaultModel = {
    userId: userId,
    status: DAILY_BONUS_TYPES.STATUS.AVAILABLE,
    currentDay: 1,
    totalDays: 0,
    completedCycles: 0,
    timestamps: {
      lastClaimed: null,
      nextAvailable: null,
      lastUpdated: now,
    },
    history: [],
  };

  logMessage('info', 'Створено модель щоденного бонусу за замовчуванням', 'createDefaultModel');

  return createDailyBonusModel(defaultModel);
}

/**
 * Обробка відповіді на запит отримання щоденного бонусу
 * @param {Object} response - Відповідь сервера
 * @param {string} userId - ID користувача
 * @returns {Object} Результат обробки
 */
function processClaimResponse(response, userId) {
  try {
    if (!response || !response.success) {
      return {
        success: false,
        error: response?.error || 'Невідома помилка',
        model: null,
        reward: null,
      };
    }

    // Оновлення моделі
    const updatedModel = convertServerToClientModel(response.data.bonus, userId);

    // Винагорода
    const reward = {
      tokens: response.data.reward?.tokens || 0,
      coins: response.data.reward?.coins || 0,
      isSpecialDay: !!response.data.reward?.is_special_day,
      completion: response.data.completion_bonus
        ? {
            tokens: response.data.completion_bonus.tokens || 0,
            coins: response.data.completion_bonus.coins || 0,
          }
        : null,
    };

    logMessage('info', 'Успішно оброблено відповідь отримання бонусу', 'processClaimResponse', {
      tokens: reward.tokens,
      coins: reward.coins,
      isCompletionReward: !!reward.completion,
    });

    return {
      success: true,
      model: updatedModel,
      reward: reward,
    };
  } catch (error) {
    logMessage('error', 'Помилка обробки відповіді отримання бонусу', '', { error });

    return {
      success: false,
      error: error.message || 'Помилка обробки відповіді',
      model: null,
      reward: null,
    };
  }
}

/**
 * Виконання запиту до API щоденних бонусів
 * @param {string} endpoint - Ендпоінт API
 * @param {Object} data - Дані для відправки
 * @returns {Promise<Object>} Результат запиту
 */
async function performBonusApiRequest(endpoint, data = {}) {
  try {
    logMessage('info', `Виконання запиту до API щоденних бонусів: ${endpoint}`, 'performBonusApiRequest');

    // Базовий URL API
    const baseApiUrl = '/api/daily-bonus';

    // Опції для запиту
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    };

    // Виконуємо запит
    const response = await fetch(`${baseApiUrl}/${endpoint}`, options);

    if (!response.ok) {
      throw new Error(`HTTP помилка: ${response.status}`);
    }

    const responseData = await response.json();

    // Перевіряємо статус відповіді
    if (!responseData.success) {
      return {
        success: false,
        error: responseData.error || 'Помилка виконання запиту',
        errorCode: responseData.error_code,
        data: null,
      };
    }

    logMessage('info', `Успішно отримано відповідь від API: ${endpoint}`, 'performBonusApiRequest');

    return {
      success: true,
      data: responseData.data,
    };
  } catch (error) {
    logMessage('error', `Помилка виконання запиту до API: ${endpoint}`, '', {
      error,
      endpoint,
      data
    });

    return {
      success: false,
      error: error.message || 'Помилка виконання запиту',
      data: null,
    };
  }
}

/**
 * Отримання статусу щоденного бонусу
 * @param {string} userId - ID користувача
 * @returns {Promise<Object>} Результат запиту
 */
async function getDailyBonusStatus(userId) {
  try {
    // Виконуємо API запит, використовуючи нашу абстракцію
    const response = await performBonusApiRequest('status', { user_id: userId });

    if (!response.success) {
      return {
        success: false,
        error: response.error,
        errorCode: response.errorCode,
      };
    }

    // Конвертуємо серверну модель в клієнтську
    const bonusModel = convertServerToClientModel(response.data.bonus, userId);

    return {
      success: true,
      bonus: bonusModel,
    };
  } catch (error) {
    logMessage('error', 'Помилка отримання статусу щоденного бонусу', '', { error, userId });

    return {
      success: false,
      error: error.message || 'Помилка отримання статусу щоденного бонусу',
    };
  }
}

/**
 * Запит на нарахування щоденного бонусу
 * @param {string} userId - ID користувача
 * @returns {Promise<Object>} Результат запиту
 */
async function claimDailyBonus(userId) {
  try {
    // Виконуємо API запит
    const response = await performBonusApiRequest('claim', { user_id: userId });

    if (!response.success) {
      return {
        success: false,
        error: response.error,
        errorCode: response.errorCode,
      };
    }

    // Обробляємо відповідь
    return processClaimResponse(response, userId);
  } catch (error) {
    logMessage('error', 'Помилка нарахування щоденного бонусу', '', { error, userId });

    return {
      success: false,
      error: error.message || 'Помилка нарахування щоденного бонусу',
    };
  }
}

/**
 * Отримання історії щоденних бонусів
 * @param {string} userId - ID користувача
 * @param {Object} options - Додаткові опції
 * @returns {Promise<Object>} Результат запиту
 */
async function getDailyBonusHistory(userId, options = {}) {
  try {
    // Опції запиту
    const requestData = {
      user_id: userId,
      limit: options.limit || 30,
      offset: options.offset || 0,
    };

    // Виконуємо API запит
    const response = await performBonusApiRequest('history', requestData);

    if (!response.success) {
      return {
        success: false,
        error: response.error,
        errorCode: response.errorCode,
      };
    }

    // Конвертуємо історію
    const history = response.data?.history || [];
    const convertedHistory = convertServerHistory(history);

    return {
      success: true,
      history: convertedHistory,
      pagination: {
        total: response.data?.total || convertedHistory.length,
        limit: requestData.limit,
        offset: requestData.offset,
      },
    };
  } catch (error) {
    logMessage('error', 'Помилка отримання історії щоденних бонусів', '', { error, userId });

    return {
      success: false,
      error: error.message || 'Помилка отримання історії щоденних бонусів',
    };
  }
}

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

// Експортуємо публічне API
export {
  convertServerToClientModel,
  convertClientToServerModel,
  processClaimResponse,
  createDefaultModel,
  getDailyBonusStatus,
  claimDailyBonus,
  getDailyBonusHistory,
  performBonusApiRequest,
  createDailyBonusModel
};

// Експорт за замовчуванням
export default dailyBonusApi;