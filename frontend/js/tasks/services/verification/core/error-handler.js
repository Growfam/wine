/**
 * Обробник помилок верифікації
 *
 * Відповідає за:
 * - Класифікацію помилок
 * - Створення стандартизованих об'єктів помилок
 * - Генерацію людиночитаних повідомлень про помилки
 */

import { VERIFICATION_STATUS } from '../../../config/index.js';
import { getLogger } from '../../../utils/core/logger.js';

// Створюємо логер для модуля
const logger = getLogger('VerificationErrors');

/**
 * Категорії помилок
 */
export const ERROR_CATEGORIES = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  AUTH: 'authorization',
  RATE_LIMIT: 'rate_limit',
  SERVER: 'server',
  CLIENT: 'client',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown'
};

/**
 * Обробка помилки верифікації
 * @param {Error} error - Об'єкт помилки
 * @param {string} taskId - ID завдання
 * @returns {Object} Оброблений результат помилки
 */
export function handleVerificationError(error, taskId) {
  logger.error(`Помилка при верифікації завдання ${taskId}:`, error);

  // Класифікуємо помилку
  const errorCategory = categorizeError(error);

  // Створюємо результат на основі категорії
  return createErrorResult(taskId, getErrorMessage(errorCategory, error), errorCategory, error);
}

/**
 * Визначення категорії помилки
 * @param {Error} error - Об'єкт помилки
 * @returns {string} Категорія помилки
 */
export function categorizeError(error) {
  // Перевіряємо тип помилки
  if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return ERROR_CATEGORIES.TIMEOUT;
  }

  if (error.name === 'TypeError' && error.message?.includes('fetch')) {
    return ERROR_CATEGORIES.NETWORK;
  }

  if (error.status === 401 || error.status === 403 || error.message?.includes('unauthorized')) {
    return ERROR_CATEGORIES.AUTH;
  }

  if (error.status === 429 || error.message?.includes('rate limit')) {
    return ERROR_CATEGORIES.RATE_LIMIT;
  }

  if (error.status >= 500 && error.status < 600) {
    return ERROR_CATEGORIES.SERVER;
  }

  if (error.status >= 400 && error.status < 500) {
    return ERROR_CATEGORIES.CLIENT;
  }

  if (error.message && error.message.includes('CORS')) {
    return ERROR_CATEGORIES.NETWORK;
  }

  if (error.message && (error.message.includes('validation') || error.message.includes('invalid'))) {
    return ERROR_CATEGORIES.VALIDATION;
  }

  return ERROR_CATEGORIES.UNKNOWN;
}

/**
 * Отримання людиночитаного повідомлення про помилку
 * @param {string} category - Категорія помилки
 * @param {Error} error - Об'єкт помилки
 * @returns {string} Повідомлення про помилку
 */
export function getErrorMessage(category, error) {
  switch (category) {
    case ERROR_CATEGORIES.TIMEOUT:
      return "Перевищено час очікування відповіді від сервера. Перевірте з'єднання та спробуйте ще раз.";

    case ERROR_CATEGORIES.NETWORK:
      return "Проблема з мережевим з'єднанням. Перевірте підключення до Інтернету та спробуйте ще раз.";

    case ERROR_CATEGORIES.AUTH:
      return 'Помилка авторизації. Оновіть сторінку та спробуйте знову.';

    case ERROR_CATEGORIES.RATE_LIMIT:
      return 'Занадто багато запитів. Будь ласка, спробуйте пізніше.';

    case ERROR_CATEGORIES.SERVER:
      return 'Сервер тимчасово недоступний. Спробуйте пізніше.';

    case ERROR_CATEGORIES.CLIENT:
      return 'Помилка запиту. Перевірте правильність даних і спробуйте знову.';

    case ERROR_CATEGORIES.VALIDATION:
      return 'Помилка валідації. Перевірте правильність даних.';

    default:
      return error.message || 'Сталася помилка під час перевірки завдання. Спробуйте пізніше.';
  }
}

/**
 * Отримання статусу верифікації на основі категорії помилки
 * @param {string} category - Категорія помилки
 * @returns {string} Статус верифікації
 */
export function getVerificationStatus(category) {
  switch (category) {
    case ERROR_CATEGORIES.TIMEOUT:
      return VERIFICATION_STATUS.TIMEOUT;

    case ERROR_CATEGORIES.NETWORK:
      return VERIFICATION_STATUS.NETWORK_ERROR;

    case ERROR_CATEGORIES.RATE_LIMIT:
      return VERIFICATION_STATUS.FAILURE;

    case ERROR_CATEGORIES.SERVER:
    case ERROR_CATEGORIES.CLIENT:
    case ERROR_CATEGORIES.AUTH:
    case ERROR_CATEGORIES.VALIDATION:
    default:
      return VERIFICATION_STATUS.ERROR;
  }
}

/**
 * Створення результату успішної верифікації
 * @param {string} taskId - ID завдання
 * @param {string} message - Повідомлення
 * @param {Object} reward - Винагорода
 * @param {Object} verificationDetails - Деталі верифікації
 * @returns {Object} Результат верифікації
 */
export function createSuccessResult(taskId, message, reward = null, verificationDetails = {}) {
  return {
    success: true,
    status: VERIFICATION_STATUS.SUCCESS,
    message: message || 'Завдання успішно виконано!',
    reward: reward || { type: 'tokens', amount: 0 },
    verification_details: verificationDetails || {},
    taskId: taskId,
    timestamp: Date.now(),
    response_time_ms: 0, // Буде оновлено пізніше
    metrics: {
      verification_time: Date.now(),
    }
  };
}

/**
 * Створення результату невдалої верифікації
 * @param {string} taskId - ID завдання
 * @param {string} message - Повідомлення
 * @param {string} error - Помилка
 * @returns {Object} Результат верифікації
 */
export function createFailureResult(taskId, message, error = null) {
  return {
    success: false,
    status: VERIFICATION_STATUS.FAILURE,
    message: message || 'Не вдалося перевірити виконання завдання',
    error: error,
    taskId: taskId,
    timestamp: Date.now(),
    metrics: {
      verification_time: Date.now(),
    }
  };
}

/**
 * Створення результату помилки верифікації
 * @param {string} taskId - ID завдання
 * @param {string} message - Повідомлення
 * @param {string} category - Категорія помилки
 * @param {Error} [error=null] - Об'єкт помилки
 * @returns {Object} Результат верифікації
 */
export function createErrorResult(taskId, message, category = ERROR_CATEGORIES.UNKNOWN, error = null) {
  return {
    success: false,
    status: getVerificationStatus(category),
    message: message || 'Сталася помилка під час перевірки завдання',
    error: error?.message || error,
    errorCategory: category,
    taskId: taskId,
    timestamp: Date.now(),
    metrics: {
      verification_time: Date.now(),
      error_category: category
    }
  };
}

export default {
  handleVerificationError,
  categorizeError,
  getErrorMessage,
  createSuccessResult,
  createFailureResult,
  createErrorResult,
  ERROR_CATEGORIES
};