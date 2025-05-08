/**
 * Модель даних щоденного бонусу
 *
 * Відповідає за:
 * - Створення і структуру моделі щоденних бонусів
 * - Бізнес-логіку для роботи з моделлю
 */

import { DAILY_BONUS_TYPES } from '../../config/types/daily-bonus-types.js';
import { getLogger } from '../../utils/core/logger.js';

// Створюємо логер для модуля
const logger = getLogger('DailyBonusModel');

/**
 * Створення моделі щоденного бонусу
 * @param {Object} data - Дані для моделі
 * @returns {Object} Модель щоденного бонусу
 */
export function createDailyBonusModel(data = {}) {
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

      /**
       * Перевірка доступності бонусу
       * @returns {Object} Результат перевірки
       */
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

      /**
       * Розрахунок винагороди
       * @returns {Object} Дані винагороди
       */
      calculateReward: function() {
        // Базовий розрахунок нагороди
        const baseTokens = 5;
        const multiplier = 1 + (this.currentDay * 0.1);
        return {
          tokens: baseTokens * multiplier,
          coins: this.currentDay >= 5 ? Math.floor(this.currentDay / 2) : 0,
          isSpecialDay: this.currentDay % 5 === 0
        };
      },

      /**
       * Перевірка, чи завершено цикл
       * @returns {boolean} Результат перевірки
       */
      isCycleCompleted: function() {
        return this.currentDay === 7; // Сьомий день - завершення циклу
      },

      /**
       * Отримання бонусу за завершення циклу
       * @returns {Object|null} Бонус або null, якщо цикл не завершено
       */
      getCompletionBonus: function() {
        if (!this.isCycleCompleted()) return null;

        return {
          tokens: 50, // Бонус за завершення циклу
          coins: 10
        };
      },

      /**
       * Додавання запису до історії
       * @param {Object} reward - Дані винагороди
       */
      addToHistory: function(reward) {
        this.history.unshift({
          day: this.currentDay,
          cycle: this.completedCycles,
          timestamp: Date.now(),
          reward: { ...reward }
        });

        // Обмежуємо розмір історії
        if (this.history.length > 30) {
          this.history = this.history.slice(0, 30);
        }
      },

      /**
       * Перехід до наступного дня
       */
      moveToNextDay: function() {
        // Збільшуємо лічильник днів
        this.totalDays++;

        // Перевіряємо завершення циклу
        if (this.currentDay === 7) {
          this.currentDay = 1;
          this.completedCycles++;
        } else {
          this.currentDay++;
        }

        // Оновлюємо статус і часові мітки
        this.status = DAILY_BONUS_TYPES.STATUS.CLAIMED;
        this.timestamps.lastClaimed = Date.now();
        this.timestamps.nextAvailable = Date.now() + 24 * 60 * 60 * 1000; // Наступний через 24 години

        logger.info(`Користувач ${this.userId} перейшов до дня ${this.currentDay}, цикл ${this.completedCycles}`, 'moveToNextDay');
      },

      /**
       * Отримання поточного стану бонусу
       * @returns {Object} Стан бонусу
       */
      getState: function() {
        return {
          userId: this.userId,
          status: this.status,
          currentDay: this.currentDay,
          totalDays: this.totalDays,
          completedCycles: this.completedCycles,
          isSpecialDay: this.currentDay % 5 === 0,
          availability: this.checkAvailability(),
          timestamps: { ...this.timestamps }
        };
      },

      /**
       * Серіалізація моделі
       * @returns {Object} Дані для серіалізації
       */
      toJSON: function() {
        return {
          userId: this.userId,
          status: this.status,
          currentDay: this.currentDay,
          totalDays: this.totalDays,
          completedCycles: this.completedCycles,
          timestamps: { ...this.timestamps },
          history: [...this.history]
        };
      }
    };
  } catch (e) {
    logger.error('Помилка створення моделі бонусу', 'createDailyBonusModel', { error: e });
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

export default createDailyBonusModel;