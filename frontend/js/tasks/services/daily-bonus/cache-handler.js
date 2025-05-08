/**
 * DailyBonusCacheHandler - обробник кешування щоденних бонусів
 *
 * Відповідає за:
 * - Кешування даних щоденного бонусу
 * - Завантаження даних з кешу
 * - Синхронізацію з localStorage
 */

import { getLogger, LOG_CATEGORIES } from '../../utils';
import { createDailyBonusModel } from '../../models/types/daily-bonus-model';
import { DAILY_BONUS_CONFIG } from '../../config/types/daily-bonus-types';

// Створюємо логер для модуля
const logger = getLogger('DailyBonusCacheHandler');

/**
 * Клас обробника кешування щоденних бонусів
 */
class DailyBonusCacheHandler {
  constructor() {
    // Ключ для кешу
    this.CACHE_KEY = DAILY_BONUS_CONFIG.CACHE_KEY;

    // Час життя кешу (7 днів)
    this.CACHE_TTL = DAILY_BONUS_CONFIG.CACHE_TTL_MS;

    // Ключі для локального кешу
    this.USER_KEYS = {}; // userId -> cacheKey
  }

  /**
   * Отримання повного ключа кешу для користувача
   * @param {string} userId - ID користувача
   * @returns {string} Ключ кешу
   * @private
   */
  _getCacheKey(userId) {
    if (!userId) return this.CACHE_KEY;

    // Перевіряємо, чи вже є ключ для цього користувача
    if (this.USER_KEYS[userId]) {
      return this.USER_KEYS[userId];
    }

    // Створюємо новий ключ
    const cacheKey = `${this.CACHE_KEY}_${userId}`;
    this.USER_KEYS[userId] = cacheKey;

    return cacheKey;
  }

  /**
   * Збереження даних в кеш
   * @param {Object} bonusModel - Модель щоденного бонусу
   * @returns {boolean} Результат збереження
   */
  saveToCache(bonusModel) {
    try {
      if (!bonusModel || !bonusModel.userId) {
        logger.warn('Неможливо зберегти дані без ID користувача', 'saveToCache', {
          category: LOG_CATEGORIES.CACHE
        });
        return false;
      }

      // Отримуємо ключ кешу
      const cacheKey = this._getCacheKey(bonusModel.userId);

      // Дані для кешу
      const cacheData = {
        data: bonusModel,
        timestamp: Date.now(),
        expires: Date.now() + this.CACHE_TTL,
        version: '1.0'
      };

      // Спочатку спробуємо використати cacheService, якщо він є
      const cacheService = window.cacheService;

      if (cacheService && typeof cacheService.set === 'function') {
        cacheService.set(cacheKey, cacheData, {
          ttl: this.CACHE_TTL,
          tags: ['daily_bonus', `user_${bonusModel.userId}`]
        });

        logger.debug('Дані збережено в cacheService', 'saveToCache', {
          category: LOG_CATEGORIES.CACHE,
          details: { userId: bonusModel.userId }
        });

        return true;
      }

      // Якщо немає cacheService, використовуємо localStorage
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));

        logger.debug('Дані збережено в localStorage', 'saveToCache', {
          category: LOG_CATEGORIES.CACHE,
          details: { userId: bonusModel.userId }
        });

        return true;
      } catch (storageError) {
        logger.warn(storageError, 'Помилка збереження в localStorage', {
          category: LOG_CATEGORIES.CACHE
        });

        return false;
      }
    } catch (error) {
      logger.error(error, 'Помилка збереження даних в кеш', {
        category: LOG_CATEGORIES.CACHE
      });

      return false;
    }
  }

  /**
   * Завантаження даних з кешу
   * @param {string} userId - ID користувача
   * @returns {Object|null} Завантажена модель або null
   */
  loadFromCache(userId) {
    try {
      if (!userId) {
        logger.warn('Неможливо завантажити дані без ID користувача', 'loadFromCache', {
          category: LOG_CATEGORIES.CACHE
        });
        return null;
      }

      // Отримуємо ключ кешу
      const cacheKey = this._getCacheKey(userId);

      // Спочатку спробуємо використати cacheService, якщо він є
      const cacheService = window.cacheService;

      if (cacheService && typeof cacheService.get === 'function') {
        const cachedData = cacheService.get(cacheKey);

        if (cachedData && cachedData.data) {
          // Перевіряємо термін дії
          if (cachedData.expires && cachedData.expires > Date.now()) {
            logger.debug('Дані завантажено з cacheService', 'loadFromCache', {
              category: LOG_CATEGORIES.CACHE,
              details: { userId }
            });

            // Створюємо модель з кешованих даних
            return createDailyBonusModel(cachedData.data);
          } else {
            // Видаляємо прострочені дані
            cacheService.remove(cacheKey);
          }
        }
      }

      // Якщо немає cacheService або дані не знайдено, використовуємо localStorage
      try {
        const storedData = localStorage.getItem(cacheKey);

        if (!storedData) return null;

        const cachedData = JSON.parse(storedData);

        // Перевіряємо термін дії
        if (cachedData.expires && cachedData.expires > Date.now()) {
          logger.debug('Дані завантажено з localStorage', 'loadFromCache', {
            category: LOG_CATEGORIES.CACHE,
            details: { userId }
          });

          // Створюємо модель з кешованих даних
          return createDailyBonusModel(cachedData.data);
        } else {
          // Видаляємо прострочені дані
          localStorage.removeItem(cacheKey);
        }
      } catch (storageError) {
        logger.warn(storageError, 'Помилка завантаження з localStorage', {
          category: LOG_CATEGORIES.CACHE
        });
      }

      return null;
    } catch (error) {
      logger.error(error, 'Помилка завантаження даних з кешу', {
        category: LOG_CATEGORIES.CACHE
      });

      return null;
    }
  }

  /**
   * Видалення даних з кешу
   * @param {string} userId - ID користувача
   * @returns {boolean} Результат видалення
   */
  removeFromCache(userId) {
    try {
      if (!userId) {
        logger.warn('Неможливо видалити дані без ID користувача', 'removeFromCache', {
          category: LOG_CATEGORIES.CACHE
        });
        return false;
      }

      // Отримуємо ключ кешу
      const cacheKey = this._getCacheKey(userId);

      // Спочатку спробуємо використати cacheService, якщо він є
      const cacheService = window.cacheService;

      if (cacheService && typeof cacheService.remove === 'function') {
        cacheService.remove(cacheKey);

        logger.debug('Дані видалено з cacheService', 'removeFromCache', {
          category: LOG_CATEGORIES.CACHE,
          details: { userId }
        });
      }

      // Також видаляємо з localStorage
      try {
        localStorage.removeItem(cacheKey);

        logger.debug('Дані видалено з localStorage', 'removeFromCache', {
          category: LOG_CATEGORIES.CACHE,
          details: { userId }
        });
      } catch (storageError) {
        logger.warn(storageError, 'Помилка видалення з localStorage', {
          category: LOG_CATEGORIES.CACHE
        });
      }

      // Видаляємо з USER_KEYS
      if (this.USER_KEYS[userId]) {
        delete this.USER_KEYS[userId];
      }

      return true;
    } catch (error) {
      logger.error(error, 'Помилка видалення даних з кешу', {
        category: LOG_CATEGORIES.CACHE
      });

      return false;
    }
  }

  /**
   * Очищення кешу для всіх користувачів
   * @returns {boolean} Результат очищення
   */
  clearAllCache() {
    try {
      // Спочатку спробуємо використати cacheService, якщо він є
      const cacheService = window.cacheService;

      if (cacheService && typeof cacheService.removeByTags === 'function') {
        cacheService.removeByTags(['daily_bonus']);

        logger.info('Кеш щоденних бонусів очищено через cacheService', 'clearAllCache', {
          category: LOG_CATEGORIES.CACHE
        });
      }

      // Також очищаємо з localStorage
      try {
        // Видаляємо всі ключі, що починаються з CACHE_KEY
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(this.CACHE_KEY)) {
            localStorage.removeItem(key);
          }
        }

        logger.info('Кеш щоденних бонусів очищено з localStorage', 'clearAllCache', {
          category: LOG_CATEGORIES.CACHE
        });
      } catch (storageError) {
        logger.warn(storageError, 'Помилка очищення з localStorage', {
          category: LOG_CATEGORIES.CACHE
        });
      }

      // Очищаємо USER_KEYS
      this.USER_KEYS = {};

      return true;
    } catch (error) {
      logger.error(error, 'Помилка очищення кешу щоденних бонусів', {
        category: LOG_CATEGORIES.CACHE
      });

      return false;
    }
  }
}

export default DailyBonusCacheHandler;