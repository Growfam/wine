/**
 * Api моделі для щоденних бонусів
 *
 * Відповідає за:
 * - Конвертацію серверних моделей в клієнтські
 * - Підготовку даних для відправки на сервер
 */

// ВИПРАВЛЕНО: Змінено абсолютні шляхи на відносні
import { DAILY_BONUS_TYPES } from '../../config/types/daily-bonus-types';
import { createDailyBonusModel } from '../../models/types/daily-bonus-model';
import { getLogger, LOG_CATEGORIES } from '../../../utils/core';

// Створюємо логер для модуля
const logger = getLogger('API.Models.DailyBonus');

/**
 * Конвертація серверної моделі в клієнтську
 * @param {Object} serverModel - Серверна модель
 * @param {string} userId - ID користувача
 * @returns {Object} Клієнтська модель
 */
export function convertServerToClientModel(serverModel, userId) {
  try {
    if (!serverModel) {
      logger.warn('Отримано порожню серверну модель', 'convertServerToClientModel', {
        category: LOG_CATEGORIES.API,
      });

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

    logger.debug('Серверна модель успішно конвертована', 'convertServerToClientModel', {
      category: LOG_CATEGORIES.API,
    });

    return createDailyBonusModel(clientModel);
  } catch (error) {
    logger.error(error, 'Помилка конвертації серверної моделі', {
      category: LOG_CATEGORIES.API,
    });

    return createDefaultModel(userId);
  }
}

/**
 * Конвертація клієнтської моделі для відправки на сервер
 * @param {Object} clientModel - Клієнтська модель
 * @returns {Object} Дані для відправки на сервер
 */
export function convertClientToServerModel(clientModel) {
  try {
    if (!clientModel) {
      logger.warn('Отримано порожню клієнтську модель', 'convertClientToServerModel', {
        category: LOG_CATEGORIES.API,
      });

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

    logger.debug(
      'Клієнтська модель успішно конвертована для сервера',
      'convertClientToServerModel',
      {
        category: LOG_CATEGORIES.API,
      }
    );

    return serverModel;
  } catch (error) {
    logger.error(error, 'Помилка конвертації клієнтської моделі для сервера', {
      category: LOG_CATEGORIES.API,
    });

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
    logger.error(error, 'Помилка конвертації історії', {
      category: LOG_CATEGORIES.API,
    });

    return [];
  }
}

/**
 * Створення моделі за замовчуванням
 * @param {string} userId - ID користувача
 * @returns {Object} Модель за замовчуванням
 */
export function createDefaultModel(userId) {
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

  logger.info('Створено модель щоденного бонусу за замовчуванням', 'createDefaultModel', {
    category: LOG_CATEGORIES.API,
  });

  return createDailyBonusModel(defaultModel);
}

/**
 * Обробка відповіді на запит отримання щоденного бонусу
 * @param {Object} response - Відповідь сервера
 * @param {string} userId - ID користувача
 * @returns {Object} Результат обробки
 */
export function processClaimResponse(response, userId) {
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

    logger.info('Успішно оброблено відповідь отримання бонусу', 'processClaimResponse', {
      category: LOG_CATEGORIES.API,
      details: {
        tokens: reward.tokens,
        coins: reward.coins,
        isCompletionReward: !!reward.completion,
      },
    });

    return {
      success: true,
      model: updatedModel,
      reward: reward,
    };
  } catch (error) {
    logger.error(error, 'Помилка обробки відповіді отримання бонусу', {
      category: LOG_CATEGORIES.API,
    });

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
export async function performBonusApiRequest(endpoint, data = {}) {
  try {
    logger.info(`Виконання запиту до API щоденних бонусів: ${endpoint}`, 'performBonusApiRequest', {
      category: LOG_CATEGORIES.API,
    });

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

    logger.info(`Успішно отримано відповідь від API: ${endpoint}`, 'performBonusApiRequest', {
      category: LOG_CATEGORIES.API,
    });

    return {
      success: true,
      data: responseData.data,
    };
  } catch (error) {
    logger.error(error, `Помилка виконання запиту до API: ${endpoint}`, {
      category: LOG_CATEGORIES.API,
      details: { endpoint, data },
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
export async function getDailyBonusStatus(userId) {
  try {
    // Виконуємо запит
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
    logger.error(error, 'Помилка отримання статусу щоденного бонусу', {
      category: LOG_CATEGORIES.API,
      details: { userId },
    });

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
export async function claimDailyBonus(userId) {
  try {
    // Виконуємо запит
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
    logger.error(error, 'Помилка нарахування щоденного бонусу', {
      category: LOG_CATEGORIES.API,
      details: { userId },
    });

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
export async function getDailyBonusHistory(userId, options = {}) {
  try {
    // Опції запиту
    const requestData = {
      user_id: userId,
      limit: options.limit || 30,
      offset: options.offset || 0,
    };

    // Виконуємо запит
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
    logger.error(error, 'Помилка отримання історії щоденних бонусів', {
      category: LOG_CATEGORIES.API,
      details: { userId, options },
    });

    return {
      success: false,
      error: error.message || 'Помилка отримання історії щоденних бонусів',
    };
  }
}

// Експортуємо публічне API
export default {
  convertServerToClientModel,
  convertClientToServerModel,
  processClaimResponse,
  createDefaultModel,
  getDailyBonusStatus,
  claimDailyBonus,
  getDailyBonusHistory,
  performBonusApiRequest,
};