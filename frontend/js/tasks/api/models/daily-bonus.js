// Файл: frontend/js/tasks/api/models/daily-bonus.js

/**
 * Api моделі для щоденних бонусів
 *
 * Відповідає за:
 * - Конвертацію серверних моделей в клієнтські
 * - Підготовку даних для відправки на сервер
 */

// Визначаємо, чи доступна система логів
const hasLogger = typeof window !== 'undefined' &&
                 window.ModuleRegistry &&
                 window.ModuleRegistry.get('logger');

// Функція логування з перевіркою доступності логера
function safeLog(level, message, source = '', details = {}) {
  try {
    if (hasLogger) {
      const logger = window.ModuleRegistry.get('logger');
      logger[level](message, source, details);
    } else {
      console[level === 'warn' ? 'warning' : level](
        `[API.Models.DailyBonus${source ? '.' + source : ''}] ${message}`,
        details
      );
    }
  } catch (e) {
    console.error('Помилка при логуванні:', e);
  }
}

// Завантажуємо типи бонусів
let DAILY_BONUS_TYPES = {
  // Тип бонусу
  TYPE: {
    STANDARD: 'standard', // Стандартний бонус
    SPECIAL: 'special', // Спеціальний бонус (свята, акції)
  },

  // Статуси бонусу
  STATUS: {
    AVAILABLE: 'available', // Доступний для отримання
    CLAIMED: 'claimed', // Вже отримано сьогодні
    EXPIRED: 'expired', // Прострочений (пропущений день)
    PENDING: 'pending', // В очікуванні (майбутній день)
    LOCKED: 'locked', // Заблокований (потрібно виконати умову)
  }
};

// Завантажуємо типи бонусів з реєстра модулів якщо можливо
try {
  if (window.ModuleRegistry && window.ModuleRegistry.get('DAILY_BONUS_TYPES')) {
    DAILY_BONUS_TYPES = window.ModuleRegistry.get('DAILY_BONUS_TYPES');
    safeLog('info', 'Завантажено типи бонусів з реєстру модулів');
  }
} catch (e) {
  safeLog('error', 'Помилка завантаження типів бонусів', '', { error: e });
}

// Функція для створення моделі бонусу
function createDailyBonusModel(data = {}) {
  try {
    // Перевіряємо наявність функції в реєстрі
    if (window.ModuleRegistry && window.ModuleRegistry.get('createDailyBonusModel')) {
      return window.ModuleRegistry.get('createDailyBonusModel')(data);
    }

    // Запасний варіант, якщо немає функції в реєстрі
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
    safeLog('error', 'Помилка створення моделі бонусу', 'createDailyBonusModel', { error: e });
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
      safeLog('warn', 'Отримано порожню серверну модель', 'convertServerToClientModel');
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

    safeLog('debug', 'Серверна модель успішно конвертована', 'convertServerToClientModel');

    return createDailyBonusModel(clientModel);
  } catch (error) {
    safeLog('error', 'Помилка конвертації серверної моделі', '', { error });
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
      safeLog('warn', 'Отримано порожню клієнтську модель', 'convertClientToServerModel');
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

    safeLog('debug', 'Клієнтська модель успішно конвертована для сервера', 'convertClientToServerModel');

    return serverModel;
  } catch (error) {
    safeLog('error', 'Помилка конвертації клієнтської моделі для сервера', '', { error });
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
    safeLog('error', 'Помилка конвертації історії', '', { error });
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

  safeLog('info', 'Створено модель щоденного бонусу за замовчуванням', 'createDefaultModel');

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

    safeLog('info', 'Успішно оброблено відповідь отримання бонусу', 'processClaimResponse', {
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
    safeLog('error', 'Помилка обробки відповіді отримання бонусу', '', { error });

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
    safeLog('info', `Виконання запиту до API щоденних бонусів: ${endpoint}`, 'performBonusApiRequest');

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

    safeLog('info', `Успішно отримано відповідь від API: ${endpoint}`, 'performBonusApiRequest');

    return {
      success: true,
      data: responseData.data,
    };
  } catch (error) {
    safeLog('error', `Помилка виконання запиту до API: ${endpoint}`, '', {
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
    // Використовуємо API модуль якщо доступний
    if (window.WinixAPI && window.WinixAPI.apiRequest) {
      const response = await window.WinixAPI.apiRequest('api/daily-bonus/status', 'POST', {
        user_id: userId
      });

      if (response.status === 'success' && response.data) {
        // Конвертуємо серверну модель в клієнтську
        const bonusModel = convertServerToClientModel(response.data.bonus, userId);

        return {
          success: true,
          bonus: bonusModel,
        };
      } else {
        return {
          success: false,
          error: response.message || 'Помилка API при отриманні статусу бонусу'
        };
      }
    }

    // Альтернативний метод запиту
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
    safeLog('error', 'Помилка отримання статусу щоденного бонусу', '', { error, userId });

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
    // Використовуємо API модуль якщо доступний
    if (window.WinixAPI && window.WinixAPI.apiRequest) {
      const response = await window.WinixAPI.apiRequest('api/daily-bonus/claim', 'POST', {
        user_id: userId
      });

      if (response.status === 'success') {
        return processClaimResponse(response, userId);
      } else {
        return {
          success: false,
          error: response.message || 'Помилка API при отриманні бонусу'
        };
      }
    }

    // Альтернативний метод запиту
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
    safeLog('error', 'Помилка нарахування щоденного бонусу', '', { error, userId });

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

    // Використовуємо API модуль якщо доступний
    if (window.WinixAPI && window.WinixAPI.apiRequest) {
      const response = await window.WinixAPI.apiRequest('api/daily-bonus/history', 'POST', requestData);

      if (response.status === 'success') {
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
      } else {
        return {
          success: false,
          error: response.message || 'Помилка API при отриманні історії бонусів'
        };
      }
    }

    // Альтернативний метод запиту
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
    safeLog('error', 'Помилка отримання історії щоденних бонусів', '', { error, userId });

    return {
      success: false,
      error: error.message || 'Помилка отримання історії щоденних бонусів',
    };
  }
}

// Реєструємо модуль для глобального доступу
if (window.ModuleRegistry) {
  window.ModuleRegistry.register('dailyBonusApi', {
    getDailyBonusStatus,
    claimDailyBonus,
    getDailyBonusHistory,
    convertServerToClientModel,
    convertClientToServerModel,
    createDefaultModel,
    createDailyBonusModel
  });
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

// Експортуємо за замовчуванням
export default {
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