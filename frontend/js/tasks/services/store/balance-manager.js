/**
 * Менеджер управління балансами користувача
 *
 * Відповідає за:
 * - Завантаження та збереження балансів
 * - Оновлення балансів у реальному часі
 * - Анімації зміни балансу в інтерфейсі
 */

import { saveToCache, loadFromCache } from './cache-handlers.js';

// Ключі для кешу
const CACHE_KEYS = {
  BALANCES: 'user_balances',
  USER_TOKENS: 'userTokens',
  USER_COINS: 'userCoins',
  WINIX_BALANCE: 'winix_balance',
  WINIX_COINS: 'winix_coins'
};

/**
 * Клас для управління балансами користувача
 */
export class BalanceManager {
  constructor() {
    // Поточні баланси користувача
    this.userBalances = {
      tokens: null,
      coins: null,
    };

    // Час життя кешу балансів (5 хвилин)
    this.CACHE_TTL = 300000;

    // Масив слухачів змін балансу
    this.listeners = [];
  }

  /**
   * Ініціалізація менеджера балансів
   */
  initialize() {
    // Завантажуємо баланси з кешу
    this.loadBalances();
  }

  /**
   * Завантаження балансів користувача з різних джерел
   * @returns {Object} Поточні баланси
   */
  loadBalances() {
    try {
      // Спочатку спробуємо завантажити з кешу
      const cachedBalances = loadFromCache(CACHE_KEYS.BALANCES);
      if (cachedBalances) {
        this.userBalances = cachedBalances;
      }

      // Далі пробуємо з DOM
      const tokensElement = document.getElementById('user-tokens');
      if (tokensElement) {
        this.userBalances.tokens = parseFloat(tokensElement.textContent) || 0;
      }

      const coinsElement = document.getElementById('user-coins');
      if (coinsElement) {
        this.userBalances.coins = parseInt(coinsElement.textContent) || 0;
      }

      // Зберігаємо оновлені баланси в кеш
      this.saveBalancesToCache();

      return this.userBalances;
    } catch (error) {
      console.warn('Помилка завантаження балансів:', error);
      return this.userBalances;
    }
  }

  /**
   * Збереження балансів у кеш
   * @private
   */
  saveBalancesToCache() {
    saveToCache(CACHE_KEYS.BALANCES, this.userBalances, {
      ttl: this.CACHE_TTL,
      tags: ['user', 'balances'],
    });

    // Зберігаємо також в окремі ключі для сумісності
    saveToCache(CACHE_KEYS.USER_TOKENS, this.userBalances.tokens.toString());
    saveToCache(CACHE_KEYS.USER_COINS, this.userBalances.coins.toString());
    saveToCache(CACHE_KEYS.WINIX_BALANCE, this.userBalances.tokens.toString());
    saveToCache(CACHE_KEYS.WINIX_COINS, this.userBalances.coins.toString());
  }

  /**
   * Оновлення балансу
   * @param {string} type - Тип балансу ('tokens' або 'coins')
   * @param {number} amount - Сума
   * @param {boolean} isIncrement - Чи є це збільшенням
   * @returns {Object} Оновлені дані балансу
   */
  updateBalance(type, amount, isIncrement = true) {
    // Нормалізуємо суму
    const normalizedAmount = parseFloat(amount) || 0;

    // Оновлюємо відповідний баланс
    const oldBalance = this.userBalances[type] || 0;
    let newBalance;

    if (type === 'tokens') {
      if (isIncrement) {
        this.userBalances.tokens += normalizedAmount;
      } else {
        this.userBalances.tokens = normalizedAmount;
      }
      newBalance = this.userBalances.tokens;
    } else if (type === 'coins') {
      if (isIncrement) {
        this.userBalances.coins += normalizedAmount;
      } else {
        this.userBalances.coins = normalizedAmount;
      }
      newBalance = this.userBalances.coins;
    }

    // Оновлюємо DOM
    this.updateBalanceUI(type, newBalance, isIncrement);

    // Зберігаємо оновлені баланси в кеш
    this.saveBalancesToCache();

    // Сповіщаємо слухачів
    this.notifyListeners({
      type,
      oldBalance,
      newBalance,
      amount: normalizedAmount,
      isIncrement,
    });

    return {
      type,
      oldBalance,
      newBalance,
      amount: normalizedAmount,
      isIncrement,
    };
  }

  /**
   * Оновлення відображення балансу в UI
   * @param {string} type - Тип балансу ('tokens' або 'coins')
   * @param {number} newBalance - Нове значення балансу
   * @param {boolean} isIncrement - Чи є це збільшенням
   * @private
   */
  updateBalanceUI(type, newBalance, isIncrement) {
    try {
      if (typeof document === 'undefined') return;

      // ID елементів в UI
      const elementIds = {
        coins: 'user-coins',
        tokens: 'user-tokens',
      };

      const elementId = elementIds[type];
      if (!elementId) return;

      // Отримуємо елемент
      const element = document.getElementById(elementId);
      if (!element) return;

      // Форматуємо значення
      let formattedValue;
      if (type === 'tokens') {
        formattedValue = newBalance.toFixed(2);
      } else {
        formattedValue = newBalance.toString();
      }

      // Оновлюємо відображення
      element.textContent = formattedValue;

      // Анімуємо зміну
      element.classList.add(isIncrement ? 'balance-increased' : 'balance-decreased');

      // Видаляємо клас анімації після завершення
      setTimeout(() => {
        element.classList.remove('balance-increased', 'balance-decreased');
      }, 1500);
    } catch (error) {
      console.warn(`Помилка оновлення UI балансу ${type}:`, error);
    }
  }

  /**
   * Отримання поточного балансу
   * @param {string} type - Тип балансу
   * @returns {number} Поточний баланс
   */
  getBalance(type) {
    if (type === 'tokens') {
      return this.userBalances.tokens || 0;
    } else if (type === 'coins') {
      return this.userBalances.coins || 0;
    }
    return 0;
  }

  /**
   * Отримання всіх балансів
   * @returns {Object} Поточні баланси
   */
  getAllBalances() {
    return { ...this.userBalances };
  }

  /**
   * Встановлення значення балансу
   * @param {string} type - Тип балансу
   * @param {number} value - Нове значення
   * @returns {Object} Результат операції
   */
  setBalance(type, value) {
    return this.updateBalance(type, value, false);
  }

  /**
   * Збільшення балансу
   * @param {string} type - Тип балансу
   * @param {number} amount - Сума збільшення
   * @returns {Object} Результат операції
   */
  increaseBalance(type, amount) {
    return this.updateBalance(type, amount, true);
  }

  /**
   * Зменшення балансу
   * @param {string} type - Тип балансу
   * @param {number} amount - Сума зменшення
   * @returns {Object} Результат операції
   */
  decreaseBalance(type, amount) {
    return this.updateBalance(type, -amount, true);
  }

  /**
   * Додавання слухача змін балансу
   * @param {Function} listener - Функція-слухач
   * @returns {Function} Функція для відписки
   */
  addListener(listener) {
    if (typeof listener !== 'function') return () => {};

    this.listeners.push(listener);
    return () => this.removeListener(listener);
  }

  /**
   * Видалення слухача змін балансу
   * @param {Function} listener - Функція-слухач
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Сповіщення всіх слухачів про зміну балансу
   * @param {Object} data - Дані про зміну
   * @private
   */
  notifyListeners(data) {
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Помилка виклику слухача балансу:', error);
      }
    });
  }

  /**
   * Скидання стану менеджера
   */
  resetState() {
    this.userBalances = {
      tokens: null,
      coins: null,
    };
    this.listeners = [];
  }
}

// Створюємо і експортуємо єдиний екземпляр
const balanceManager = new BalanceManager();
export default balanceManager;