/**
 * API-методи для роботи з щоденними бонусами
 *
 * Відповідає за:
 * - Виконання запитів до API щоденних бонусів
 * - Отримання статусу бонусу
 * - Отримання та обробку бонусів
 */

import { getLogger } from '../../utils/core/logger.js';
import { processClaimResponse, convertServerToClientModel } from './daily-bonus-converters.js';

// Створюємо логер для модуля
const logger = getLogger('DailyBonusAPI');

/**
 * Виконання запиту до API щоденних бонусів
 * @param {string} endpoint - Ендпоінт API
 * @param {Object} data - Дані для відправки
 * @returns {Promise<Object>} Результат запиту
 */
export async function performBonusApiRequest(endpoint, data = {}) {
  try {
    logger.info(`Виконання запиту до API щоденних бонусів: ${endpoint}`, 'performBonusApiRequest');

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

    logger.info(`Успішно отримано відповідь від API: ${endpoint}`, 'performBonusApiRequest');

    return {
      success: true,
      data: responseData.data,
    };
  } catch (error) {
    logger.error(`Помилка виконання запиту до API: ${endpoint}`, 'performBonusApiRequest', {
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
export async function getDailyBonusStatus(userId) {
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
    logger.error('Помилка отримання статусу щоденного бонусу', 'getDailyBonusStatus', { error, userId });

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
    logger.error('Помилка нарахування щоденного бонусу', 'claimDailyBonus', { error, userId });

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
    logger.error('Помилка отримання історії щоденних бонусів', 'getDailyBonusHistory', { error, userId });

    return {
      success: false,
      error: error.message || 'Помилка отримання історії щоденних бонусів',
    };
  }
}

// Експорт всіх API методів
export default {
  performBonusApiRequest,
  getDailyBonusStatus,
  claimDailyBonus,
  getDailyBonusHistory
};