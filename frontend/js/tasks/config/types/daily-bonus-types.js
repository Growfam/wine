/**
 * Модель щоденного бонусу
 *
 * Відповідає за структуру даних щоденного бонусу та методи роботи з ним.
 */

// Визначаємо константи тут, щоб уникнути циклічних залежностей
export const DAILY_BONUS_TYPES = {
  STATUS: {
    PENDING: 'pending',    // Очікує на отримання
    CLAIMED: 'claimed',    // Уже отримано
    EXPIRED: 'expired',    // Термін дії минув
  },
};

export const DAILY_BONUS_CONFIG = {
  // Кількість днів у циклі
  CYCLE_DAYS: 7,

  // Базова винагорода
  BASE_REWARD: {
    tokens: 10,
  },

  // Множники для кожного дня циклу
  MULTIPLIERS: {
    1: 1.0,  // День 1: базова винагорода
    2: 1.2,  // День 2: +20%
    3: 1.5,  // День 3: +50%
    4: 1.8,  // День 4: +80%
    5: 2.0,  // День 5: +100%
    6: 2.2,  // День 6: +120%
    7: 3.0,  // День 7: +200%
  },

  // Дні, в які видаються жетони
  COIN_DAYS: [3, 5, 7],

  // Кількість жетонів для кожного дня
  COIN_REWARDS: {
    3: 1,   // 1 жетон на день 3
    5: 2,   // 2 жетони на день 5
    7: 5,   // 5 жетонів на день 7
  },

  // Бонус за завершення циклу
  COMPLETION_BONUS: {
    tokens: 50,
    coins: 10,
  },
};

/**
 * Створення моделі щоденного бонусу
 * @param {Object} data - Базові дані для моделі
 * @returns {Object} Модель щоденного бонусу з методами
 */
export function createDailyBonusModel(data = {}) {
  // Базові дані бонусу
  const model = {
    // ID користувача
    userId: data.userId || '',

    // Поточний статус бонусу
    status: data.status || DAILY_BONUS_TYPES.STATUS.PENDING,

    // Поточний день циклу (1-7)
    currentDay: data.currentDay || 1,

    // Загальна кількість днів з початку збору бонусів
    totalDays: data.totalDays || 0,

    // Кількість завершених циклів
    completedCycles: data.completedCycles || 0,

    // Часові мітки
    timestamps: {
      // Коли був отриманий останній бонус
      lastClaimed: data.timestamps?.lastClaimed || null,

      // Коли буде доступний наступний бонус
      nextAvailable: data.timestamps?.nextAvailable || null,

      // Коли модель була останній раз оновлена
      lastUpdated: data.timestamps?.lastUpdated || Date.now(),
    },

    // Історія отриманих бонусів
    history: data.history || [],

    /**
     * Перевірка доступності бонусу
     * @returns {Object} Результат перевірки
     */
    checkAvailability() {
      const now = Date.now();

      // Якщо немає часової мітки останнього отримання
      if (!this.timestamps.lastClaimed) {
        return {
          available: true,
          reason: 'first_time',
        };
      }

      // Якщо вже отримано сьогодні
      if (this.status === DAILY_BONUS_TYPES.STATUS.CLAIMED &&
          this.timestamps.nextAvailable &&
          this.timestamps.nextAvailable > now) {
        return {
          available: false,
          reason: 'already_claimed',
          nextAvailable: this.timestamps.nextAvailable,
          timeRemaining: this.timestamps.nextAvailable - now,
        };
      }

      // Якщо час до наступного бонусу вже вийшов
      if (this.timestamps.nextAvailable && this.timestamps.nextAvailable <= now) {
        return {
          available: true,
          reason: 'time_elapsed',
        };
      }

      // За замовчуванням - доступний
      return {
        available: true,
        reason: 'available',
      };
    },

    /**
     * Розрахунок винагороди за поточний день
     * @returns {Object} Дані винагороди
     */
    calculateReward() {
      // Базова винагорода
      const baseReward = DAILY_BONUS_CONFIG.BASE_REWARD;

      // День циклу (1-7)
      const cycleDay = this.currentDay % DAILY_BONUS_CONFIG.CYCLE_DAYS || DAILY_BONUS_CONFIG.CYCLE_DAYS;

      // Множник для поточного дня
      const multiplier = DAILY_BONUS_CONFIG.MULTIPLIERS[cycleDay] || 1.0;

      // Токени з урахуванням множника
      const tokens = Math.round(baseReward.tokens * multiplier);

      // Жетони (для спеціальних днів)
      let coins = 0;
      if (DAILY_BONUS_CONFIG.COIN_DAYS.includes(cycleDay)) {
        coins = DAILY_BONUS_CONFIG.COIN_REWARDS[cycleDay] || 0;
      }

      return {
        day: cycleDay,
        tokens,
        coins,
        isSpecialDay: DAILY_BONUS_CONFIG.COIN_DAYS.includes(cycleDay),
      };
    },

    /**
     * Перевірка, чи завершено поточний цикл
     * @returns {boolean} Результат перевірки
     */
    isCycleCompleted() {
      // Перевіряємо, чи поточний день є останнім у циклі
      return this.currentDay % DAILY_BONUS_CONFIG.CYCLE_DAYS === 0;
    },

    /**
     * Отримання бонусу за завершення циклу
     * @returns {Object} Дані бонусу
     */
    getCompletionBonus() {
      if (!this.isCycleCompleted()) {
        return null;
      }

      return {
        tokens: DAILY_BONUS_CONFIG.COMPLETION_BONUS.tokens,
        coins: DAILY_BONUS_CONFIG.COMPLETION_BONUS.coins,
      };
    },

    /**
     * Додавання запису в історію бонусів
     * @param {Object} reward - Дані винагороди
     */
    addToHistory(reward) {
      const historyEntry = {
        day: this.currentDay,
        cycle: Math.floor((this.currentDay - 1) / DAILY_BONUS_CONFIG.CYCLE_DAYS) + 1,
        timestamp: Date.now(),
        reward: {
          tokens: reward.tokens || 0,
          coins: reward.coins || 0,
          isSpecialDay: reward.isSpecialDay || false,
        },
      };

      this.history.push(historyEntry);

      // Обмежуємо розмір історії
      if (this.history.length > 30) {
        this.history = this.history.slice(-30);
      }
    },

    /**
     * Перетворення моделі в об'єкт для зберігання
     * @returns {Object} Дані моделі
     */
    toJSON() {
      return {
        userId: this.userId,
        status: this.status,
        currentDay: this.currentDay,
        totalDays: this.totalDays,
        completedCycles: this.completedCycles,
        timestamps: { ...this.timestamps },
        history: [...this.history],
      };
    },
  };

  return model;
}

export default createDailyBonusModel;