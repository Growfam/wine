/**
 * DailyBonusRewardPreview - компонент для відображення винагороди щоденного бонусу
 *
 * Відповідає за:
 * - Відображення доступної винагороди
 * - Анімацію отримання винагороди
 */

import { getLogger, LOG_CATEGORIES } from '../../../utils/index.js';
import { DAILY_BONUS_CONFIG } from '../../../config/types/daily-bonus-types.js';

// Створюємо логер для модуля
const logger = getLogger('UI.DailyBonusRewardPreview');

/**
 * Клас компонента відображення винагороди
 */
class DailyBonusRewardPreview {
  /**
   * Конструктор
   * @param {Object} options - Налаштування
   */
  constructor(options = {}) {
    // Налаштування
    this.options = {
      container: null, // Контейнер для рендерингу
      day: 1, // День циклу (1-7)
      tokens: 0, // Кількість токенів
      coins: 0, // Кількість жетонів
      isSpecialDay: false, // Чи особливий день
      theme: 'default', // Тема оформлення
      ...options,
    };

    // Внутрішній стан
    this.state = {
      elementId: `daily-bonus-reward-${Date.now()}`, // ID елемента
      initialized: false, // Чи ініціалізовано
      animationInProgress: false, // Чи відбувається анімація
      updating: false, // Чи відбувається оновлення
    };

    // Ініціалізуємо, якщо є контейнер
    if (this.options.container) {
      this.initialize(this.options.container);
    }
  }

  /**
   * Ініціалізація компонента
   * @param {HTMLElement|string} container - Контейнер для рендерингу
   * @returns {boolean} Результат ініціалізації
   */
  initialize(container) {
    try {
      // Шукаємо контейнер
      if (typeof container === 'string') {
        container = document.querySelector(container);
      }

      if (!container) {
        logger.warn('Контейнер для відображення винагороди не знайдено', 'initialize', {
          category: LOG_CATEGORIES.RENDERING,
        });
        return false;
      }

      // Зберігаємо контейнер
      this.options.container = container;

      // Рендеримо компонент
      this.render();

      // Позначаємо ініціалізацію
      this.state.initialized = true;

      logger.info('Компонент відображення винагороди ініціалізовано', 'initialize', {
        category: LOG_CATEGORIES.INIT,
      });

      return true;
    } catch (error) {
      logger.error(error, 'Помилка ініціалізації компонента відображення винагороди', {
        category: LOG_CATEGORIES.INIT,
      });

      return false;
    }
  }

  /**
   * Рендеринг компонента
   */
  render() {
    try {
      const container = this.options.container;
      if (!container) return;

      // Очищаємо контейнер
      container.innerHTML = '';

      // Визначаємо винагороду
      let { tokens, coins } = this.options;

      // Якщо значення не передані, обчислюємо зі значень за замовчуванням
      if (!tokens) {
        const multiplier = DAILY_BONUS_CONFIG.MULTIPLIERS[this.options.day] || 1;
        tokens = DAILY_BONUS_CONFIG.BASE_REWARD.tokens * multiplier;
      }

      if (!coins && this.options.isSpecialDay) {
        coins = DAILY_BONUS_CONFIG.COIN_REWARDS[this.options.day] || 0;
      }

      // Заокруглюємо значення
      tokens = parseFloat(tokens.toFixed(2));
      coins = parseInt(coins, 10);

      // Створюємо елемент відображення винагороди
      const rewardElement = document.createElement('div');
      rewardElement.id = this.state.elementId;
      rewardElement.className = `daily-bonus-reward ${this.options.theme}`;

      // Створюємо заголовок
      const heading = document.createElement('div');
      heading.className = 'daily-bonus-reward-header';
      heading.textContent = 'Сьогоднішня винагорода:';
      rewardElement.appendChild(heading);

      // Створюємо контейнер для токенів
      const tokensContainer = document.createElement('div');
      tokensContainer.className = 'daily-bonus-reward-tokens';

      tokensContainer.innerHTML = `
        <div class="reward-icon tokens"></div>
        <div class="reward-amount">+${tokens}</div>
        <div class="reward-type">$WINIX</div>
      `;

      rewardElement.appendChild(tokensContainer);

      // Якщо є жетони, додаємо їх також
      if (coins > 0) {
        const coinsContainer = document.createElement('div');
        coinsContainer.className = 'daily-bonus-reward-coins';

        coinsContainer.innerHTML = `
          <div class="reward-icon coins"></div>
          <div class="reward-amount">+${coins}</div>
          <div class="reward-type">жетонів</div>
        `;

        rewardElement.appendChild(coinsContainer);
      }

      // Додаємо до контейнера
      container.appendChild(rewardElement);

      logger.debug('Компонент відображення винагороди відрендерено', 'render', {
        category: LOG_CATEGORIES.RENDERING,
        details: { tokens, coins },
      });
    } catch (error) {
      logger.error(error, 'Помилка рендерингу компонента відображення винагороди', {
        category: LOG_CATEGORIES.RENDERING,
      });
    }
  }

  /**
   * Оновлення компонента
   * @param {Object} options - Опції для оновлення
   */
  update(options = {}) {
    if (this.state.updating) return;

    try {
      this.state.updating = true;

      // Оновлюємо опції
      if (options.day !== undefined) {
        this.options.day = options.day;
      }

      if (options.tokens !== undefined) {
        this.options.tokens = options.tokens;
      }

      if (options.coins !== undefined) {
        this.options.coins = options.coins;
      }

      if (options.isSpecialDay !== undefined) {
        this.options.isSpecialDay = options.isSpecialDay;
      }

      if (options.theme !== undefined) {
        this.options.theme = options.theme;
      }

      // Перерендерюємо
      this.render();

      logger.info('Компонент відображення винагороди оновлено', 'update', {
        category: LOG_CATEGORIES.RENDERING,
        details: {
          day: this.options.day,
          tokens: this.options.tokens,
          coins: this.options.coins,
        },
      });
    } catch (error) {
      logger.error(error, 'Помилка оновлення компонента відображення винагороди', {
        category: LOG_CATEGORIES.RENDERING,
      });
    } finally {
      this.state.updating = false;
    }
  }

  /**
   * Анімація отримання винагороди
   * @param {Function} callback - Функція, яка викликається після анімації
   * @param {boolean} withSound - Чи програвати звук
   */
  animateReward(callback, withSound = true) {
    try {
      if (this.state.animationInProgress) return;

      this.state.animationInProgress = true;

      // Отримуємо елементи винагороди
      const rewardElement = document.getElementById(this.state.elementId);
      if (!rewardElement) {
        this.state.animationInProgress = false;
        if (typeof callback === 'function') callback();
        return;
      }

      // Застосовуємо клас анімації
      rewardElement.classList.add('animated');

      // Додаємо частинки, якщо потрібно
      if (typeof window.createParticles === 'function') {
        window.createParticles({
          container: rewardElement,
          count: 20,
          duration: 1500,
        });
      }

      // Програємо звук, якщо потрібно
      if (withSound && typeof window.playSound === 'function') {
        window.playSound('reward');
      }

      // Знімаємо флаг анімації через 1.5 секунди
      setTimeout(() => {
        this.state.animationInProgress = false;

        // Видаляємо клас анімації
        rewardElement.classList.remove('animated');

        // Викликаємо callback, якщо він є
        if (typeof callback === 'function') {
          callback();
        }
      }, 1500);

      logger.info('Анімація отримання винагороди', 'animateReward', {
        category: LOG_CATEGORIES.ANIMATION,
        details: {
          tokens: this.options.tokens,
          coins: this.options.coins,
        },
      });
    } catch (error) {
      logger.error(error, 'Помилка анімації отримання винагороди', {
        category: LOG_CATEGORIES.ANIMATION,
      });

      this.state.animationInProgress = false;

      // Викликаємо callback, якщо він є
      if (typeof callback === 'function') {
        callback();
      }
    }
  }

  /**
   * Очищення ресурсів
   */
  destroy() {
    try {
      // Очищаємо контейнер
      if (this.options.container) {
        this.options.container.innerHTML = '';
      }

      // Очищаємо внутрішній стан
      this.state.initialized = false;

      logger.info('Ресурси компонента відображення винагороди очищено', 'destroy');
    } catch (error) {
      logger.error(error, 'Помилка очищення ресурсів компонента відображення винагороди', {
        category: LOG_CATEGORIES.LOGIC,
      });
    }
  }
}

export default DailyBonusRewardPreview;
