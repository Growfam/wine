/**
 * DailyBonusModel - модель даних щоденного бонусу
 *
 * Відповідає за:
 * - Структуру даних щоденного бонусу
 * - Розрахунок винагород
 * - Перевірку статусів
 */

import { DAILY_BONUS_TYPES, DAILY_BONUS_CONFIG } from '../../config/types/daily-bonus-types.js';
import { getLogger, LOG_CATEGORIES } from '../../utils';

// Створюємо логер для модуля
const logger = getLogger('DailyBonusModel');

/**
 * Клас моделі щоденного бонусу
 */
export class DailyBonusModel {
  /**
   * Конструктор
   * @param {Object} data - Дані щоденного бонусу
   */
  constructor(data = {}) {
    // ID користувача
    this.userId = data.userId || null;

    // Поточний статус
    this.status = data.status || DAILY_BONUS_TYPES.STATUS.PENDING;

    // Поточний день циклу (1-7)
    this.currentDay = data.currentDay || 1;

    // Загальна кількість днів послідовності
    this.totalDays = data.totalDays || 0;

    // Завершені цикли
    this.completedCycles = data.completedCycles || 0;

    // Часові мітки
    this.timestamps = {
      lastClaimed: data.timestamps?.lastClaimed || null,
      nextAvailable: data.timestamps?.nextAvailable || null,
      lastUpdated: Date.now(),
    };

    // Історія отриманих бонусів
    this.history = data.history || [];

    // Чи є сьогоднішній день спеціальним (з жетонами)
    this.isSpecialDay = this._checkIfSpecialDay();
  }

  /**
   * Перевірка, чи є поточний день спеціальним (з жетонами)
   * @returns {boolean} результат перевірки
   * @private
   */
  _checkIfSpecialDay() {
    return DAILY_BONUS_CONFIG.COIN_DAYS.includes(this.currentDay);
  }

  /**
   * Оновлення даних моделі
   * @param {Object} data - Нові дані
   */
  update(data) {
    if (!data) return;

    // Оновлюємо основні поля
    if (data.status) this.status = data.status;
    if (data.currentDay !== undefined) this.currentDay = data.currentDay;
    if (data.totalDays !== undefined) this.totalDays = data.totalDays;
    if (data.completedCycles !== undefined) this.completedCycles = data.completedCycles;

    // Оновлюємо часові мітки
    if (data.timestamps) {
      if (data.timestamps.lastClaimed) {
        this.timestamps.lastClaimed = data.timestamps.lastClaimed;
      }
      if (data.timestamps.nextAvailable) {
        this.timestamps.nextAvailable = data.timestamps.nextAvailable;
      }
    }

    // Оновлюємо мітку останнього оновлення
    this.timestamps.lastUpdated = Date.now();

    // Оновлюємо історію, якщо потрібно
    if (data.history && Array.isArray(data.history)) {
      this.history = data.history;
    }

    // Перевіряємо, чи є день спеціальним
    this.isSpecialDay = this._checkIfSpecialDay();

    logger.debug('Модель щоденного бонусу оновлена', 'update', {
      category: LOG_CATEGORIES.MODELS,
    });
  }

  /**
   * Розрахунок поточної винагороди
   * @returns {Object} Дані винагороди
   */
  calculateReward() {
    // Базова винагорода
    const baseTokens = DAILY_BONUS_CONFIG.BASE_REWARD.tokens;
    const baseCoins = DAILY_BONUS_CONFIG.BASE_REWARD.coins;

    // Отримуємо множник для поточного дня
    const multiplier = DAILY_BONUS_CONFIG.MULTIPLIERS[this.currentDay] || 1;

    // Розраховуємо винагороду
    const tokens = baseTokens * multiplier;

    // Визначаємо кількість жетонів
    let coins = baseCoins;
    if (this.isSpecialDay) {
      coins = DAILY_BONUS_CONFIG.COIN_REWARDS[this.currentDay] || 0;
    }

    // Логуємо розрахунок
    logger.debug(`Розраховано винагороду: ${tokens} токенів, ${coins} жетонів`, 'calculateReward', {
      category: LOG_CATEGORIES.LOGIC,
      details: {
        day: this.currentDay,
        multiplier,
        isSpecialDay: this.isSpecialDay,
      },
    });

    return {
      tokens,
      coins,
      multiplier,
      isSpecialDay: this.isSpecialDay,
    };
  }

  /**
   * Перевірка, чи завершено цикл
   * @returns {boolean} Результат перевірки
   */
  isCycleCompleted() {
    return this.currentDay === DAILY_BONUS_CONFIG.CYCLE_DAYS;
  }

  /**
   * Отримання бонусу за завершення циклу
   * @returns {Object|null} Дані бонусу або null, якщо цикл не завершено
   */
  getCompletionBonus() {
    if (!this.isCycleCompleted()) return null;

    return {
      tokens: DAILY_BONUS_CONFIG.COMPLETION_BONUS.tokens,
      coins: DAILY_BONUS_CONFIG.COMPLETION_BONUS.coins,
    };
  }

  /**
   * Перевірка доступності бонусу
   * @returns {Object} Результат перевірки
   */
  checkAvailability() {
    const now = Date.now();

    // Якщо бонус вже отримано сьогодні
    if (this.status === DAILY_BONUS_TYPES.STATUS.CLAIMED) {
      // Перевіряємо, чи настав час для нового бонусу
      if (this.timestamps.nextAvailable && now >= this.timestamps.nextAvailable) {
        return {
          available: true,
          status: DAILY_BONUS_TYPES.STATUS.AVAILABLE,
          nextTime: null,
          reason: 'RESET_TIME_PASSED',
        };
      }

      return {
        available: false,
        status: DAILY_BONUS_TYPES.STATUS.CLAIMED,
        nextTime: this.timestamps.nextAvailable,
        reason: 'ALREADY_CLAIMED',
      };
    }

    // Якщо бонус доступний
    if (this.status === DAILY_BONUS_TYPES.STATUS.AVAILABLE) {
      return {
        available: true,
        status: DAILY_BONUS_TYPES.STATUS.AVAILABLE,
        nextTime: null,
        reason: 'AVAILABLE',
      };
    }

    // Якщо бонус прострочено
    if (this.status === DAILY_BONUS_TYPES.STATUS.EXPIRED) {
      // Перевіряємо, чи можна відновити серію
      const lastClaimedTime = this.timestamps.lastClaimed || 0;
      const daysPassed = Math.floor((now - lastClaimedTime) / (24 * 60 * 60 * 1000));

      if (daysPassed <= DAILY_BONUS_CONFIG.MAX_RECOVERY_DAYS) {
        return {
          available: true,
          status: DAILY_BONUS_TYPES.STATUS.AVAILABLE,
          nextTime: null,
          reason: 'RECOVERY_AVAILABLE',
        };
      }

      // Якщо пройшло забагато днів, починаємо новий цикл
      return {
        available: true,
        status: DAILY_BONUS_TYPES.STATUS.AVAILABLE,
        nextTime: null,
        reason: 'NEW_CYCLE',
      };
    }

    // Якщо статус pending, перевіряємо, чи пройшов час
    if (this.status === DAILY_BONUS_TYPES.STATUS.PENDING) {
      if (this.timestamps.nextAvailable && now >= this.timestamps.nextAvailable) {
        return {
          available: true,
          status: DAILY_BONUS_TYPES.STATUS.AVAILABLE,
          nextTime: null,
          reason: 'WAIT_TIME_PASSED',
        };
      }

      return {
        available: false,
        status: DAILY_BONUS_TYPES.STATUS.PENDING,
        nextTime: this.timestamps.nextAvailable,
        reason: 'WAITING',
      };
    }

    // За замовчуванням
    return {
      available: false,
      status: this.status,
      nextTime: this.timestamps.nextAvailable,
      reason: 'UNKNOWN',
    };
  }

  /**
   * Додавання запису в історію
   * @param {Object} reward - Дані винагороди
   */
  addToHistory(reward) {
    const historyRecord = {
      day: this.currentDay,
      cycle: this.completedCycles,
      timestamp: Date.now(),
      reward: { ...reward },
    };

    this.history.unshift(historyRecord);

    // Обмежуємо розмір історії
    if (this.history.length > 30) {
      this.history = this.history.slice(0, 30);
    }
  }

  /**
   * Отримання поточного стану бонусу
   * @returns {Object} Стан бонусу
   */
  getState() {
    return {
      status: this.status,
      currentDay: this.currentDay,
      totalDays: this.totalDays,
      completedCycles: this.completedCycles,
      isSpecialDay: this.isSpecialDay,
      timestamps: { ...this.timestamps },
      availability: this.checkAvailability(),
    };
  }

  /**
   * Перехід до наступного дня
   */
  moveToNextDay() {
    // Збільшуємо лічильник днів
    this.totalDays++;

    // Якщо це останній день циклу, завершуємо цикл
    if (this.currentDay === DAILY_BONUS_CONFIG.CYCLE_DAYS) {
      this.currentDay = 1;
      this.completedCycles++;

      logger.info('Завершено цикл щоденних бонусів', 'moveToNextDay', {
        category: LOG_CATEGORIES.LOGIC,
        details: { completedCycles: this.completedCycles },
      });
    } else {
      // Інакше просто збільшуємо поточний день
      this.currentDay++;
    }

    // Оновлюємо прапорець спеціального дня
    this.isSpecialDay = this._checkIfSpecialDay();

    // Оновлюємо статус і часові мітки
    this.status = DAILY_BONUS_TYPES.STATUS.CLAIMED;
    this.timestamps.lastClaimed = Date.now();
    this.timestamps.nextAvailable = Date.now() + DAILY_BONUS_CONFIG.RESET_TIME_MS;

    logger.info(`Здійснено перехід до дня ${this.currentDay}`, 'moveToNextDay', {
      category: LOG_CATEGORIES.LOGIC,
    });
  }
}

/**
 * Створення моделі щоденного бонусу
 * @param {Object} data - Початкові дані
 * @returns {DailyBonusModel} Нова модель
 */
export function createDailyBonusModel(data = {}) {
  return new DailyBonusModel(data);
}

export default createDailyBonusModel;
