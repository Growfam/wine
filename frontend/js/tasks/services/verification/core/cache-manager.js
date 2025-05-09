/**
 * Менеджер кешування для верифікації
 *
 * Відповідає за:
 * - Кешування типів завдань
 * - Кешування результатів верифікації
 * - Очищення кешу
 */

import { getLogger } from 'js/tasks/utils/core/logger.js';

// Створюємо логер для модуля
const logger = getLogger('VerificationCache');

// Константи для кешу
export const CACHE_KEYS = {
  TASK_TYPE: 'task_type_',
  VERIFICATION_RESULT: 'verification_result_',
  PROCESSED_EVENT: 'processed_event_',
};

// Час життя кешу для різних типів даних (мс)
export const CACHE_TTL = {
  TASK_TYPE: 86400000, // 24 години
  SUCCESS_RESULT: 1800000, // 30 хвилин для успішних результатів
  FAILURE_RESULT: 600000, // 10 хвилин для невдалих результатів
  PROCESSED_EVENT: 3600000, // 1 година
};

/**
 * Кешування типу завдання
 * @param {string} taskId - ID завдання
 * @param {string} type - Тип завдання
 * @returns {boolean} Результат операції
 */
export function cacheTaskType(taskId, type) {
  try {
    if (!taskId || !type) return false;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.TASK_TYPE}${taskId}`;

    // Використовуємо localStorage для базової реалізації кешування
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(cacheKey, type);
    }

    // Якщо є глобальний сервіс кешування, використовуємо його
    const cacheService = window.cacheService;
    if (cacheService && typeof cacheService.set === 'function') {
      cacheService.set(cacheKey, type, {
        tags: ['task_type', taskId],
        ttl: CACHE_TTL.TASK_TYPE,
      });
    }

    logger.debug(`Тип завдання ${taskId} кешовано як ${type}`, 'cacheTaskType');
    return true;
  } catch (error) {
    logger.warn(`Помилка при кешуванні типу завдання ${taskId}:`, error);
    return false;
  }
}

/**
 * Отримання кешованого типу завдання
 * @param {string} taskId - ID завдання
 * @returns {string|null} Тип завдання
 */
export function getCachedTaskType(taskId) {
  try {
    if (!taskId) return null;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.TASK_TYPE}${taskId}`;

    // Спочатку перевіряємо глобальний сервіс кешування
    const cacheService = window.cacheService;
    if (cacheService && typeof cacheService.get === 'function') {
      const cachedType = cacheService.get(cacheKey);
      if (cachedType) {
        return cachedType;
      }
    }

    // Потім перевіряємо localStorage
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(cacheKey);
    }

    return null;
  } catch (error) {
    logger.warn(`Помилка при отриманні кешованого типу завдання ${taskId}:`, error);
    return null;
  }
}

/**
 * Кешування результату верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} result - Результат перевірки
 * @returns {boolean} Результат операції
 */
export function cacheVerificationResult(taskId, result) {
  try {
    if (!taskId || !result) return false;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.VERIFICATION_RESULT}${taskId}`;

    // Час життя кешу залежить від успішності результату
    const ttl = result.success ? CACHE_TTL.SUCCESS_RESULT : CACHE_TTL.FAILURE_RESULT;

    const cacheData = {
      result,
      timestamp: Date.now(),
      expires: Date.now() + ttl,
    };

    // Використовуємо localStorage для базової реалізації кешування
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    }

    // Якщо є глобальний сервіс кешування, використовуємо його
    const cacheService = window.cacheService;
    if (cacheService && typeof cacheService.set === 'function') {
      cacheService.set(cacheKey, cacheData, {
        ttl,
        tags: ['verification', 'result', taskId],
      });
    }

    logger.debug(`Результат верифікації для завдання ${taskId} кешовано`, 'cacheVerificationResult');
    return true;
  } catch (error) {
    logger.warn(`Помилка при кешуванні результату верифікації для завдання ${taskId}:`, error);
    return false;
  }
}

/**
 * Отримання кешованого результату верифікації
 * @param {string} taskId - ID завдання
 * @returns {Object|null} Результат перевірки
 */
export function getCachedVerificationResult(taskId) {
  try {
    if (!taskId) return null;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.VERIFICATION_RESULT}${taskId}`;
    let cachedData = null;

    // Спочатку перевіряємо глобальний сервіс кешування
    const cacheService = window.cacheService;
    if (cacheService && typeof cacheService.get === 'function') {
      cachedData = cacheService.get(cacheKey);
    }

    // Потім перевіряємо localStorage, якщо не знайдено в cacheService
    if (!cachedData && typeof localStorage !== 'undefined') {
      const storedData = localStorage.getItem(cacheKey);
      if (storedData) {
        try {
          cachedData = JSON.parse(storedData);
        } catch (parseError) {
          logger.warn(`Помилка парсингу кешованого результату для завдання ${taskId}:`, parseError);
        }
      }
    }

    // Перевіряємо термін дії кешу
    if (cachedData && cachedData.expires) {
      if (Date.now() > cachedData.expires) {
        logger.debug(`Кеш для завдання ${taskId} застарів`, 'getCachedVerificationResult');
        return null;
      }

      return cachedData.result;
    }

    return null;
  } catch (error) {
    logger.warn(`Помилка при отриманні кешованого результату для завдання ${taskId}:`, error);
    return null;
  }
}

/**
 * Кешування обробленої події
 * @param {string} eventId - ID події
 * @param {Object} data - Дані події
 * @returns {boolean} Результат операції
 */
export function cacheProcessedEvent(eventId, data) {
  try {
    if (!eventId) return false;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.PROCESSED_EVENT}${eventId}`;

    const cacheData = {
      ...data,
      timestamp: Date.now(),
      expires: Date.now() + CACHE_TTL.PROCESSED_EVENT,
    };

    // Якщо є глобальний сервіс кешування, використовуємо його
    const cacheService = window.cacheService;
    if (cacheService && typeof cacheService.set === 'function') {
      cacheService.set(cacheKey, cacheData, {
        ttl: CACHE_TTL.PROCESSED_EVENT,
        tags: ['verification', 'events'],
      });
    }

    return true;
  } catch (error) {
    logger.warn(`Помилка кешування обробленої події ${eventId}:`, error);
    return false;
  }
}

/**
 * Перевірка, чи подія вже оброблена
 * @param {string} eventId - ID події
 * @returns {boolean} Чи оброблена подія
 */
export function isEventProcessed(eventId) {
  try {
    if (!eventId) return false;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.PROCESSED_EVENT}${eventId}`;

    // Перевіряємо через глобальний сервіс кешування
    const cacheService = window.cacheService;
    if (cacheService && typeof cacheService.get === 'function') {
      const cachedEvent = cacheService.get(cacheKey);
      return !!cachedEvent;
    }

    return false;
  } catch (error) {
    logger.warn(`Помилка перевірки обробленої події ${eventId}:`, error);
    return false;
  }
}

/**
 * Очищення всього кешу верифікації
 * @returns {boolean} Результат операції
 */
export function clearCache() {
  try {
    // Очищаємо кеш через глобальний сервіс, якщо доступно
    const cacheService = window.cacheService;
    if (cacheService) {
      if (typeof cacheService.removeByTags === 'function') {
        cacheService.removeByTags(['verification']);
      } else if (typeof cacheService.clear === 'function') {
        cacheService.clear();
      }
    }

    // Очищаємо локальне сховище від записів з ключами верифікації
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage)
        .filter(key =>
          key.startsWith(CACHE_KEYS.TASK_TYPE) ||
          key.startsWith(CACHE_KEYS.VERIFICATION_RESULT) ||
          key.startsWith(CACHE_KEYS.PROCESSED_EVENT)
        )
        .forEach(key => localStorage.removeItem(key));
    }

    logger.info('Кеш верифікації очищено', 'clearCache');
    return true;
  } catch (error) {
    logger.error('Помилка при очищенні кешу верифікації:', error);
    return false;
  }
}

/**
 * Очищення застарілих подій
 * @returns {number} Кількість очищених подій
 */
export function clearExpiredEvents() {
  try {
    // Очищаємо тільки через глобальний сервіс, якщо доступно
    const cacheService = window.cacheService;
    if (!cacheService) return 0;

    // Отримуємо всі ключі з тегом 'events'
    const keys = cacheService.getKeysByTag?.('events') || [];
    let clearedCount = 0;

    // Перевіряємо кожен ключ на термін дії
    keys.forEach(key => {
      const event = cacheService.get(key);
      if (event && event.expires && event.expires < Date.now()) {
        cacheService.remove(key);
        clearedCount++;
      }
    });

    if (clearedCount > 0) {
      logger.debug(`Очищено ${clearedCount} застарілих подій`, 'clearExpiredEvents');
    }

    return clearedCount;
  } catch (error) {
    logger.warn('Помилка при очищенні застарілих подій:', error);
    return 0;
  }
}

// Функція для ініціалізації менеджера кешування
export function setupCacheManager(verificationCore) {
  // Тут можна додати ініціалізацію або додаткові налаштування
  logger.info('Менеджер кешування ініціалізовано');

  // Періодичне очищення застарілих подій
  const cleanupInterval = setInterval(() => {
    clearExpiredEvents();
  }, 1800000); // кожні 30 хвилин

  return {
    clearInterval: () => clearInterval(cleanupInterval)
  };
}

// Експортуємо все для зручного імпорту
export default {
  cacheTaskType,
  getCachedTaskType,
  cacheVerificationResult,
  getCachedVerificationResult,
  cacheProcessedEvent,
  isEventProcessed,
  clearCache,
  clearExpiredEvents,
  setupCacheManager,
  CACHE_KEYS,
  CACHE_TTL
};