/**
 * Конвертери для моделі щоденного бонусу
 *
 * Відповідає за:
 * - Конвертацію серверних моделей в клієнтські
 * - Конвертацію клієнтських моделей для сервера
 * - Підготовку результатів для відображення
 */

import { getLogger } from '../../utils/core/logger.js';
import { DAILY_BONUS_TYPES } from 'config/daily-bonus-types.js';
import { createDailyBonusModel } from './daily-bonus-model.js';

// Створюємо логер для модуля
const logger = getLogger('DailyBonusConverters');

/**
 * Конвертація серверної моделі в клієнтську
 * @param {Object} serverModel - Серверна модель
 * @param {string} userId - ID користувача
 * @returns {Object} Клієнтська модель
 */
export function convertServerToClientModel(serverModel, userId) {
  try {
    if (!serverModel) {
      logger.warn('Отримано порожню серверну модель', 'convertServerToClientModel');
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

    logger.debug('Серверна модель успішно конвертована', 'convertServerToClientModel');

    return createDailyBonusModel(clientModel);
  } catch (error) {
    logger.error('Помилка конвертації серверної моделі', 'convertServerToClientModel', { error });
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
      logger.warn('Отримано порожню клієнтську модель', 'convertClientToServerModel');
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

    logger.debug('Клієнтська модель успішно конвертована для сервера', 'convertClientToServerModel');

    return serverModel;
  } catch (error) {
    logger.error('Помилка конвертації клієнтської моделі для сервера', 'convertClientToServerModel', { error });
    return null;
  }
}

/**
 * Конвертація історії з серверної моделі
 * @param {Array} serverHistory - Історія з серверної моделі
 * @returns {Array} Історія для клієнтської моделі
 */
export function convertServerHistory(serverHistory) {
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
    logger.error('Помилка конвертації історії', 'convertServerHistory', { error });
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

  logger.info('Створено модель щоденного бонусу за замовчуванням', 'createDefaultModel');

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
    logger.error('Помилка обробки відповіді отримання бонусу', 'processClaimResponse', { error });

    return {
      success: false,
      error: error.message || 'Помилка обробки відповіді',
      model: null,
      reward: null,
    };
  }
}

export default {
  convertServerToClientModel,
  convertClientToServerModel,
  convertServerHistory,
  createDefaultModel,
  processClaimResponse
};