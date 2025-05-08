/**
 * DailyBonusService - сервіс для управління щоденними бонусами
 *
 * Відповідає за:
 * - Отримання поточного стану бонусу
 * - Перевірку можливості отримання бонусу
 * - Отримання бонусу
 * - Скидання циклу бонусів
 */

import { getLogger, LOG_CATEGORIES } from '../../utils';
import { DAILY_BONUS_TYPES, DAILY_BONUS_CONFIG } from '../../config/types/daily-bonus-types';
import { createDailyBonusModel } from '../../models/types/daily-bonus-model';
import { UserProvider } from '../integration/user-provider';
import { getDailyBonusStatus, claimDailyBonus } from '../../api';
import DailyBonusCacheHandler from './cache-handler';

// Створюємо логер для модуля
const logger = getLogger('DailyBonusService');

// Клас сервісу щоденних бонусів
class DailyBonusService {
  constructor() {
    // Поточна модель бонусу
    this.currentBonus = null;

    // Флаг ініціалізації
    this.initialized = false;

    // Провайдер користувача
    this.userProvider = new UserProvider();

    // Обробник кешу
    this.cacheHandler = new DailyBonusCacheHandler();

    // Таймер для перевірки доступності
    this.checkTimer = null;

    // Флаг завантаження даних
    this.loading = false;

    // Ключі подій
    this.EVENTS = {
      BONUS_AVAILABLE: 'daily_bonus_available',
      BONUS_CLAIMED: 'daily_bonus_claimed',
      BONUS_UPDATED: 'daily_bonus_updated',
      CYCLE_COMPLETED: 'daily_bonus_cycle_completed',
    };

    // Підписники
    this.subscribers = [];
  }

  /**
   * Ініціалізація сервісу
   * @returns {Promise<boolean>} Результат ініціалізації
   */
  async initialize() {
    if (this.initialized) return true;

    try {
      logger.info('Ініціалізація сервісу щоденних бонусів', 'initialize', {
        category: LOG_CATEGORIES.INIT,
      });

      // Отримуємо ID користувача
      const userIdResult = this.userProvider.safeGetUserId();
      if (!userIdResult.success) {
        logger.warn('Неможливо отримати ID користувача', 'initialize', {
          category: LOG_CATEGORIES.AUTH,
          details: userIdResult,
        });
        return false;
      }

      // Спроба завантажити з кешу
      const cachedBonus = this.cacheHandler.loadFromCache(userIdResult.userId);
      if (cachedBonus) {
        this.currentBonus = cachedBonus;
        logger.info('Завантажено дані бонусу з кешу', 'initialize', {
          category: LOG_CATEGORIES.CACHE,
        });

        // Перевіряємо доступність
        this._checkAvailability();
      }

      // Запускаємо завантаження свіжих даних з сервера
      this.fetchCurrentBonus();

      // Встановлюємо таймер перевірки
      this._setupAvailabilityTimer();

      // Позначаємо ініціалізацію завершеною
      this.initialized = true;

      return true;
    } catch (error) {
      logger.error(error, 'Помилка ініціалізації сервісу щоденних бонусів', {
        category: LOG_CATEGORIES.INIT,
      });

      return false;
    }
  }

  /**
   * Завантаження поточного бонусу з сервера
   * @returns {Promise<Object>} Поточний бонус
   */
  async fetchCurrentBonus() {
    if (this.loading) {
      logger.info('Завантаження даних вже відбувається', 'fetchCurrentBonus');
      return this.currentBonus;
    }

    this.loading = true;

    try {
      // Отримуємо ID користувача
      const userIdResult = this.userProvider.safeGetUserId();
      if (!userIdResult.success) {
        throw new Error('Неможливо отримати ID користувача');
      }

      // Запит до API
      const response = await getDailyBonusStatus(userIdResult.userId);

      if (!response.success) {
        throw new Error(response.error || 'Помилка отримання статусу бонусу');
      }

      // Оновлюємо поточний бонус
      this.currentBonus = response.bonus;

      // Зберігаємо в кеш
      this.cacheHandler.saveToCache(this.currentBonus);

      // Перевіряємо доступність
      this._checkAvailability();

      // Сповіщаємо підписників
      this._notifySubscribers(this.EVENTS.BONUS_UPDATED, {
        bonus: this.currentBonus,
      });

      logger.info('Успішно завантажено дані бонусу з сервера', 'fetchCurrentBonus', {
        category: LOG_CATEGORIES.API,
      });

      return this.currentBonus;
    } catch (error) {
      logger.error(error, 'Помилка завантаження бонусу з сервера', {
        category: LOG_CATEGORIES.API,
      });

      // Якщо немає поточного бонусу, створюємо за замовчуванням
      if (!this.currentBonus) {
        const userIdResult = this.userProvider.safeGetUserId();
        const userId = userIdResult.success ? userIdResult.userId : 'unknown';

        this.currentBonus = createDailyBonusModel({
          userId: userId,
          status: DAILY_BONUS_TYPES.STATUS.AVAILABLE,
        });
      }

      return this.currentBonus;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Отримання поточного бонусу
   * @param {boolean} refresh - Примусове оновлення з сервера
   * @returns {Promise<Object>} Поточний бонус
   */
  async getCurrentBonus(refresh = false) {
    if (refresh || !this.currentBonus) {
      return this.fetchCurrentBonus();
    }

    return this.currentBonus;
  }

  /**
   * Перевірка доступності бонусу
   * @returns {Object} Результат перевірки
   */
  _checkAvailability() {
    if (!this.currentBonus) return null;

    // Отримуємо результат перевірки
    const availability = this.currentBonus.checkAvailability();

    // Якщо статус змінився на доступний, сповіщаємо
    if (availability.available && this.currentBonus.status !== DAILY_BONUS_TYPES.STATUS.AVAILABLE) {
      // Оновлюємо статус
      this.currentBonus.status = DAILY_BONUS_TYPES.STATUS.AVAILABLE;

      // Зберігаємо в кеш
      this.cacheHandler.saveToCache(this.currentBonus);

      // Сповіщаємо підписників
      this._notifySubscribers(this.EVENTS.BONUS_AVAILABLE, {
        bonus: this.currentBonus,
      });

      logger.info('Бонус став доступним', '_checkAvailability', {
        category: LOG_CATEGORIES.LOGIC,
      });
    }

    return availability;
  }

  /**
   * Встановлення таймера перевірки доступності
   * @private
   */
  _setupAvailabilityTimer() {
    // Спочатку очищаємо попередній таймер
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    // Запускаємо перевірку кожну хвилину
    this.checkTimer = setInterval(() => {
      this._checkAvailability();
    }, 60000); // 1 хвилина

    logger.debug('Таймер перевірки доступності встановлено', '_setupAvailabilityTimer');
  }

  /**
   * Отримання щоденного бонусу
   * @returns {Promise<Object>} Результат отримання
   */
  async claimDailyBonus() {
    try {
      if (!this.currentBonus) {
        await this.fetchCurrentBonus();
      }

      // Перевіряємо доступність
      const availability = this._checkAvailability();
      if (!availability || !availability.available) {
        return {
          success: false,
          error: 'Бонус недоступний',
          availability,
        };
      }

      // Отримуємо ID користувача
      const userIdResult = this.userProvider.safeGetUserId();
      if (!userIdResult.success) {
        throw new Error('Неможливо отримати ID користувача');
      }

      // Отримуємо дані про поточну винагороду
      const reward = this.currentBonus.calculateReward();

      // Перевіряємо, чи завершено цикл
      const isCycleCompleted = this.currentBonus.isCycleCompleted();
      const completionBonus = isCycleCompleted ? this.currentBonus.getCompletionBonus() : null;

      // Запит до API
      const response = await claimDailyBonus(userIdResult.userId);

      if (!response.success) {
        throw new Error(response.error || 'Помилка отримання бонусу');
      }

      // Оновлюємо поточний бонус
      this.currentBonus = response.model;

      // Зберігаємо в кеш
      this.cacheHandler.saveToCache(this.currentBonus);

      // Додаємо запис в історію
      this.currentBonus.addToHistory(response.reward);

      // Оновлюємо баланс користувача через динамічний імпорт
      // для уникнення циклічних залежностей
      try {
        const { default: taskStore } = await import('../store/index.js');

        if (response.reward.tokens > 0) {
          taskStore.updateBalance('tokens', response.reward.tokens, true);
        }

        if (response.reward.coins > 0) {
          taskStore.updateBalance('coins', response.reward.coins, true);
        }

        // Якщо є бонус за завершення циклу
        if (response.reward.completion) {
          // Оновлюємо баланс
          if (response.reward.completion.tokens > 0) {
            taskStore.updateBalance('tokens', response.reward.completion.tokens, true);
          }

          if (response.reward.completion.coins > 0) {
            taskStore.updateBalance('coins', response.reward.completion.coins, true);
          }
        }
      } catch (error) {
        logger.warn(`Не вдалося оновити баланс: ${error.message}`, 'claimDailyBonus');
      }

      // Якщо є бонус за завершення циклу
      if (response.reward.completion) {
        // Сповіщаємо про завершення циклу
        this._notifySubscribers(this.EVENTS.CYCLE_COMPLETED, {
          bonus: this.currentBonus,
          completionBonus: response.reward.completion,
        });
      }

      // Сповіщаємо підписників
      this._notifySubscribers(this.EVENTS.BONUS_CLAIMED, {
        bonus: this.currentBonus,
        reward: response.reward,
      });

      logger.info('Успішно отримано щоденний бонус', 'claimDailyBonus', {
        category: LOG_CATEGORIES.REWARDS,
        details: {
          tokens: response.reward.tokens,
          coins: response.reward.coins,
          isCycleCompleted,
        },
      });

      return {
        success: true,
        reward: response.reward,
        isCycleCompleted,
        completionBonus: response.reward.completion,
      };
    } catch (error) {
      logger.error(error, 'Помилка отримання щоденного бонусу', {
        category: LOG_CATEGORIES.REWARDS,
      });

      return {
        success: false,
        error: error.message || 'Помилка отримання бонусу',
      };
    }
  }

  /**
   * Підписка на події
   * @param {string} eventType - Тип події
   * @param {Function} callback - Функція для виклику
   * @returns {Function} Функція для відписки
   */
  subscribe(eventType, callback) {
    if (!eventType || typeof callback !== 'function') {
      return () => {};
    }

    this.subscribers.push({
      eventType,
      callback,
    });

    // Повертаємо функцію відписки
    return () => {
      this.subscribers = this.subscribers.filter(
        (sub) => sub.callback !== callback || sub.eventType !== eventType
      );
    };
  }

  /**
   * Сповіщення підписників
   * @param {string} eventType - Тип події
   * @param {Object} data - Дані події
   * @private
   */
  _notifySubscribers(eventType, data) {
    // Викликаємо підписників
    this.subscribers
      .filter((sub) => sub.eventType === eventType)
      .forEach((sub) => {
        try {
          sub.callback(data);
        } catch (error) {
          logger.error(error, 'Помилка виклику підписника', {
            category: LOG_CATEGORIES.EVENTS,
            details: { eventType },
          });
        }
      });

    // Також створюємо загальну подію
    document.dispatchEvent(
      new CustomEvent(eventType, {
        detail: data,
      })
    );
  }

  /**
   * Скидання циклу бонусів
   * @returns {Promise<boolean>} Результат скидання
   */
  async resetBonusCycle() {
    try {
      // Отримуємо ID користувача
      const userIdResult = this.userProvider.safeGetUserId();
      if (!userIdResult.success) {
        throw new Error('Неможливо отримати ID користувача');
      }

      // Створюємо нову модель
      this.currentBonus = createDailyBonusModel({
        userId: userIdResult.userId,
        status: DAILY_BONUS_TYPES.STATUS.AVAILABLE,
        currentDay: 1,
        totalDays: 0,
        completedCycles: 0,
      });

      // Зберігаємо в кеш
      this.cacheHandler.saveToCache(this.currentBonus);

      // Сповіщаємо підписників
      this._notifySubscribers(this.EVENTS.BONUS_UPDATED, {
        bonus: this.currentBonus,
      });

      logger.info('Цикл бонусів скинуто', 'resetBonusCycle', {
        category: LOG_CATEGORIES.LOGIC,
      });

      return true;
    } catch (error) {
      logger.error(error, 'Помилка скидання циклу бонусів', {
        category: LOG_CATEGORIES.LOGIC,
      });

      return false;
    }
  }

  /**
   * Очищення ресурсів
   */
  cleanup() {
    // Очищаємо таймер
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    // Очищаємо підписників
    this.subscribers = [];

    // Скидаємо флаг ініціалізації
    this.initialized = false;

    logger.info('Ресурси сервісу щоденних бонусів очищено', 'cleanup');
  }
}

// Створюємо і експортуємо екземпляр сервісу
const dailyBonusService = new DailyBonusService();
export default dailyBonusService;