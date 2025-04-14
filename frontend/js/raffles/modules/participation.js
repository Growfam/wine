/**
 * Модуль для участі в розіграшах WINIX
 * Забезпечує надійну та безпечну участь користувачів у розіграшах
 * @version 2.0.0
 */

import WinixRaffles from '../globals.js';
import { showLoading, hideLoading, showToast, copyToClipboard, showConfirm } from '../utils/ui-helpers.js';
import api from '../services/api.js';
import { formatDate } from '../utils/formatters.js';
import { CONFIG } from '../config.js';

/**
 * Класс TransactionManager для управління транзакційністю участі в розіграшах
 * Забезпечує атомарність операцій та захист від дублювання запитів
 */
class TransactionManager {
  constructor() {
    this.activeTransactions = new Map();
    this.pendingTimeouts = new Map();
    this.transactionHistory = new Map();
    this.MAX_TRANSACTION_TIME = CONFIG.API.TIMEOUT || 30000;
  }

  /**
   * Початок нової транзакції
   * @param {string} transactionId - Унікальний ідентифікатор транзакції
   * @param {Object} metadata - Метадані транзакції
   * @returns {boolean} Результат початку транзакції
   */
  startTransaction(transactionId, metadata = {}) {
    // Перевірка, чи транзакція вже в процесі
    if (this.isTransactionActive(transactionId)) {
      WinixRaffles.logger.warn(`Транзакція ${transactionId} вже активна`);
      return false;
    }

    // Створюємо нову транзакцію
    const transaction = {
      id: transactionId,
      startTime: Date.now(),
      status: 'active',
      metadata,
      steps: []
    };

    // Зберігаємо транзакцію
    this.activeTransactions.set(transactionId, transaction);

    // Встановлюємо таймаут для автоматичного завершення
    const timeoutId = setTimeout(() => {
      this.abortTransaction(transactionId, 'timeout');
    }, this.MAX_TRANSACTION_TIME);

    this.pendingTimeouts.set(transactionId, timeoutId);

    WinixRaffles.logger.log(`Започатковано транзакцію ${transactionId}`);
    return true;
  }

  /**
   * Завершення транзакції
   * @param {string} transactionId - Ідентифікатор транзакції
   * @param {string} status - Статус завершення (success|failure)
   * @param {Object} result - Результат транзакції
   * @returns {boolean} Результат завершення
   */
  completeTransaction(transactionId, status = 'success', result = {}) {
    if (!this.isTransactionActive(transactionId)) {
      WinixRaffles.logger.warn(`Спроба завершити неактивну транзакцію ${transactionId}`);
      return false;
    }

    // Отримуємо транзакцію
    const transaction = this.activeTransactions.get(transactionId);

    // Очищаємо таймаут
    if (this.pendingTimeouts.has(transactionId)) {
      clearTimeout(this.pendingTimeouts.get(transactionId));
      this.pendingTimeouts.delete(transactionId);
    }

    // Оновлюємо статус транзакції
    transaction.status = status;
    transaction.endTime = Date.now();
    transaction.result = result;
    transaction.duration = transaction.endTime - transaction.startTime;

    // Переміщаємо транзакцію в історію
    this.transactionHistory.set(transactionId, transaction);
    this.activeTransactions.delete(transactionId);

    WinixRaffles.logger.log(`Завершено транзакцію ${transactionId} зі статусом ${status} за ${transaction.duration}мс`);
    return true;
  }

  /**
   * Примусове переривання транзакції
   * @param {string} transactionId - Ідентифікатор транзакції
   * @param {string} reason - Причина переривання
   * @returns {boolean} Результат переривання
   */
  abortTransaction(transactionId, reason = 'manual') {
    if (!this.isTransactionActive(transactionId)) {
      WinixRaffles.logger.warn(`Спроба перервати неактивну транзакцію ${transactionId}`);
      return false;
    }

    // Отримуємо транзакцію
    const transaction = this.activeTransactions.get(transactionId);

    // Очищаємо таймаут
    if (this.pendingTimeouts.has(transactionId)) {
      clearTimeout(this.pendingTimeouts.get(transactionId));
      this.pendingTimeouts.delete(transactionId);
    }

    // Оновлюємо статус транзакції
    transaction.status = 'aborted';
    transaction.endTime = Date.now();
    transaction.abortReason = reason;
    transaction.duration = transaction.endTime - transaction.startTime;

    // Переміщаємо транзакцію в історію
    this.transactionHistory.set(transactionId, transaction);
    this.activeTransactions.delete(transactionId);

    WinixRaffles.logger.warn(`Перервано транзакцію ${transactionId} з причини: ${reason}`);
    return true;
  }

  /**
   * Додавання кроку до транзакції
   * @param {string} transactionId - Ідентифікатор транзакції
   * @param {string} stepName - Назва кроку
   * @param {Object} data - Дані кроку
   * @returns {boolean} Результат додавання
   */
  addTransactionStep(transactionId, stepName, data = {}) {
    if (!this.isTransactionActive(transactionId)) {
      WinixRaffles.logger.warn(`Спроба додати крок до неактивної транзакції ${transactionId}`);
      return false;
    }

    // Отримуємо транзакцію
    const transaction = this.activeTransactions.get(transactionId);

    // Додаємо крок
    transaction.steps.push({
      name: stepName,
      timestamp: Date.now(),
      data
    });

    WinixRaffles.logger.debug(`Додано крок "${stepName}" до транзакції ${transactionId}`);
    return true;
  }

  /**
   * Перевірка активності транзакції
   * @param {string} transactionId - Ідентифікатор транзакції
   * @returns {boolean} Статус активності
   */
  isTransactionActive(transactionId) {
    return this.activeTransactions.has(transactionId);
  }

  /**
   * Генерація унікального ідентифікатора транзакції
   * @param {string} prefix - Префікс для ідентифікатора
   * @returns {string} Унікальний ідентифікатор
   */
  generateTransactionId(prefix = 'tx') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Очищення всіх активних транзакцій
   * @returns {number} Кількість очищених транзакцій
   */
  clearAllTransactions() {
    const count = this.activeTransactions.size;

    // Очищаємо всі таймаути
    for (const [transactionId, timeoutId] of this.pendingTimeouts.entries()) {
      clearTimeout(timeoutId);
    }

    this.pendingTimeouts.clear();
    this.activeTransactions.clear();

    WinixRaffles.logger.warn(`Очищено ${count} активних транзакцій`);
    return count;
  }
}

/**
 * Клас для валідації даних розіграшів
 */
class RaffleValidator {
  /**
   * Перевірка валідності ID розіграшу (UUID формат)
   * @param {string} raffleId - ID розіграшу для перевірки
   * @returns {boolean} Результат перевірки
   */
  static isValidRaffleId(raffleId) {
    if (!raffleId || typeof raffleId !== 'string') {
      WinixRaffles.logger.error(`Невалідний ID розіграшу: ${raffleId} (не є рядком)`);
      return false;
    }

    // Перевірка формату UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(raffleId)) {
      WinixRaffles.logger.error(`Невалідний формат UUID для розіграшу: ${raffleId}`);
      return false;
    }

    return true;
  }

  /**
   * Перевірка кількості жетонів для участі
   * @param {number} entryCount - Кількість жетонів
   * @param {number} userCoins - Кількість доступних жетонів у користувача
   * @param {number} tokenCost - Вартість одного жетону
   * @returns {Object} Результат перевірки з деталями
   */
  static validateEntryCount(entryCount, userCoins, tokenCost = 1) {
    // Перевірка на числовий тип
    if (typeof entryCount !== 'number' || isNaN(entryCount)) {
      return {
        valid: false,
        message: 'Кількість жетонів має бути числом',
        code: 'invalid_type'
      };
    }

    // Перевірка на позитивне число
    if (entryCount <= 0) {
      return {
        valid: false,
        message: 'Кількість жетонів має бути більше нуля',
        code: 'invalid_value'
      };
    }

    // Перевірка на ціле число
    if (!Number.isInteger(entryCount)) {
      return {
        valid: false,
        message: 'Кількість жетонів має бути цілим числом',
        code: 'not_integer'
      };
    }

    // Перевірка наявності достатньої кількості жетонів
    const totalCost = entryCount * tokenCost;
    if (userCoins < totalCost) {
      return {
        valid: false,
        message: `Недостатньо жетонів. Потрібно ${totalCost}, у вас ${userCoins}`,
        code: 'insufficient_coins',
        deficit: totalCost - userCoins
      };
    }

    return {
      valid: true,
      totalCost
    };
  }

  /**
   * Перевірка статусу розіграшу
   * @param {Object} raffleData - Дані розіграшу
   * @returns {Object} Результат перевірки з деталями
   */
  static validateRaffleStatus(raffleData) {
    if (!raffleData) {
      return {
        valid: false,
        message: 'Дані розіграшу відсутні',
        code: 'no_data'
      };
    }

    // Перевірка наявності статусу
    if (!raffleData.status) {
      return {
        valid: false,
        message: 'Статус розіграшу невідомий',
        code: 'unknown_status'
      };
    }

    // Перевірка, що розіграш активний
    if (raffleData.status !== 'active') {
      return {
        valid: false,
        message: 'Цей розіграш вже завершено або скасовано',
        code: 'inactive_raffle',
        status: raffleData.status
      };
    }

    // Перевірка, що не вийшов термін
    if (raffleData.end_time) {
      const now = new Date();
      const endTime = new Date(raffleData.end_time);

      if (!isNaN(endTime.getTime()) && endTime < now) {
        return {
          valid: false,
          message: 'Цей розіграш вже завершено за часом',
          code: 'expired_raffle'
        };
      }
    }

    return {
      valid: true
    };
  }
}

/**
 * Клас для управління кешем розіграшів
 */
class RaffleCache {
  constructor() {
    this.raffleDetailsCache = new Map();
    this.activeRaffleIds = new Set();
    this.cacheTTL = 300000; // 5 хвилин

    // Завантажуємо збережені ID розіграшів з localStorage
    this._loadFromStorage();
  }

  /**
   * Завантаження кешу з локального сховища
   * @private
   */
  _loadFromStorage() {
    try {
      const storedIds = localStorage.getItem('activeRaffleIds');
      if (storedIds) {
        const parsedIds = JSON.parse(storedIds);
        if (Array.isArray(parsedIds)) {
          parsedIds.forEach(id => this.activeRaffleIds.add(id));
          WinixRaffles.logger.log(`Завантажено ${this.activeRaffleIds.size} ID активних розіграшів з кешу`);
        }
      }
    } catch (e) {
      WinixRaffles.logger.warn("Не вдалося завантажити ID розіграшів з localStorage:", e);
    }
  }

  /**
   * Збереження кешу в локальне сховище
   * @private
   */
  _saveToStorage() {
    try {
      localStorage.setItem('activeRaffleIds', JSON.stringify([...this.activeRaffleIds]));
    } catch (e) {
      WinixRaffles.logger.warn("Не вдалося зберегти ID розіграшів в localStorage:", e);
    }
  }

  /**
   * Отримання деталей розіграшу з кешу
   * @param {string} raffleId - ID розіграшу
   * @returns {Object|null} Дані розіграшу або null
   */
  getRaffleDetails(raffleId) {
    if (!this.raffleDetailsCache.has(raffleId)) {
      return null;
    }

    const cachedData = this.raffleDetailsCache.get(raffleId);

    // Перевіряємо термін дії кешу
    if (Date.now() - cachedData.timestamp > this.cacheTTL) {
      this.raffleDetailsCache.delete(raffleId);
      return null;
    }

    return cachedData.data;
  }

  /**
   * Збереження деталей розіграшу в кеш
   * @param {string} raffleId - ID розіграшу
   * @param {Object} data - Дані розіграшу
   */
  setRaffleDetails(raffleId, data) {
    if (!raffleId || !data) return;

    this.raffleDetailsCache.set(raffleId, {
      data,
      timestamp: Date.now()
    });

    // Якщо розіграш активний, додаємо його ID до списку
    if (data.status === 'active') {
      this.activeRaffleIds.add(raffleId);
      this._saveToStorage();
    }
  }

  /**
   * Видалення розіграшу з кешу
   * @param {string} raffleId - ID розіграшу
   */
  removeRaffle(raffleId) {
    this.raffleDetailsCache.delete(raffleId);
    this.activeRaffleIds.delete(raffleId);
    this._saveToStorage();
  }

  /**
   * Оновлення списку активних розіграшів
   * @param {Array<string>} raffleIds - Список ID активних розіграшів
   */
  updateActiveRaffles(raffleIds) {
    if (!Array.isArray(raffleIds)) return;

    // Очищаємо поточний список
    this.activeRaffleIds.clear();

    // Додаємо нові ID
    raffleIds.forEach(id => this.activeRaffleIds.add(id));

    // Зберігаємо в локальне сховище
    this._saveToStorage();

    WinixRaffles.logger.log(`Оновлено список активних розіграшів (${this.activeRaffleIds.size})`);
  }

  /**
   * Перевірка наявності розіграшу в списку активних
   * @param {string} raffleId - ID розіграшу
   * @returns {boolean} Результат перевірки
   */
  isRaffleActive(raffleId) {
    return this.activeRaffleIds.has(raffleId);
  }

  /**
   * Очищення всього кешу
   */
  clearAll() {
    this.raffleDetailsCache.clear();
    this.activeRaffleIds.clear();

    try {
      localStorage.removeItem('activeRaffleIds');
    } catch (e) {
      WinixRaffles.logger.warn("Не вдалося очистити кеш в localStorage:", e);
    }

    WinixRaffles.logger.log("Кеш розіграшів повністю очищено");
  }
}

/**
 * Клас для управління UI модальних вікон розіграшів
 */
class RaffleModalManager {
  constructor() {
    this.activeModals = new Set();
  }

  /**
   * Відкриття модального вікна розіграшу
   * @param {string} modalId - ID модального вікна
   * @param {Object} raffleData - Дані розіграшу
   * @param {string} raffleType - Тип розіграшу
   * @returns {HTMLElement|null} Елемент модального вікна
   */
  openRaffleModal(modalId, raffleData, raffleType) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      WinixRaffles.logger.error(`Модальне вікно з id ${modalId} не знайдено`);
      return null;
    }

    try {
      // Оновлюємо дані в модальному вікні
      this._updateModalContent(modal, raffleData, raffleType);

      // Відкриваємо модальне вікно
      modal.classList.add('open');
      this.activeModals.add(modalId);

      // Додаємо обробник закриття
      this._setupCloseHandlers(modal);

      return modal;
    } catch (error) {
      WinixRaffles.logger.error(`Помилка відкриття модального вікна ${modalId}:`, error);
      return null;
    }
  }

  /**
   * Закриття модального вікна
   * @param {string} modalId - ID модального вікна
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('open');
    this.activeModals.delete(modalId);

    // Відправляємо подію про закриття модального вікна
    WinixRaffles.events.emit('modal-closed', { modalId });
  }

  /**
   * Закриття всіх відкритих модальних вікон
   */
  closeAllModals() {
    // Створюємо копію множини для ітерації
    const modalsToClose = [...this.activeModals];

    modalsToClose.forEach(modalId => {
      this.closeModal(modalId);
    });
  }

  /**
   * Встановлення обробників закриття модального вікна
   * @param {HTMLElement} modal - Елемент модального вікна
   * @private
   */
  _setupCloseHandlers(modal) {
    // Видаляємо старі обробники, щоб уникнути дублювання
    const oldCloseButtons = modal.querySelectorAll('.modal-close, .cancel-btn');
    oldCloseButtons.forEach(btn => {
      const oldClone = btn.cloneNode(true);
      if (btn.parentNode) {
        btn.parentNode.replaceChild(oldClone, btn);
      }
    });

    // Додаємо нові обробники
    const closeButtons = modal.querySelectorAll('.modal-close, .cancel-btn');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeModal(modal.id);
      });
    });

    // Додаємо обробник кліку на фон
    const modalClickHandler = (e) => {
      if (e.target === modal) {
        this.closeModal(modal.id);
      }
    };

    // Видаляємо старий обробник
    modal.removeEventListener('click', modalClickHandler);

    // Додаємо новий обробник
    modal.addEventListener('click', modalClickHandler);
  }

  /**
   * Оновлення вмісту модального вікна
   * @param {HTMLElement} modal - Елемент модального вікна
   * @param {Object} raffleData - Дані розіграшу
   * @param {string} raffleType - Тип розіграшу
   * @private
   */
  _updateModalContent(modal, raffleData, raffleType) {
    if (!raffleData) return;

    try {
      // Оновлюємо загальні елементи
      this._updateCommonElements(modal, raffleData);

      // Викликаємо відповідну функцію залежно від типу розіграшу
      if (raffleType === 'daily') {
        this._updateDailyRaffleContent(modal, raffleData);
      } else {
        this._updateMainRaffleContent(modal, raffleData);
      }
    } catch (error) {
      WinixRaffles.logger.error(`Помилка оновлення вмісту модального вікна:`, error);
    }
  }

  /**
   * Оновлення спільних елементів модального вікна
   * @param {HTMLElement} modal - Елемент модального вікна
   * @param {Object} raffleData - Дані розіграшу
   * @private
   */
  _updateCommonElements(modal, raffleData) {
    // Оновлюємо заголовок
    const titleElement = modal.querySelector('.modal-title');
    if (titleElement) {
      titleElement.textContent = raffleData.title || 'Розіграш';
    }

    // Оновлюємо приз
    const prizeElement = modal.querySelector('.prize-value');
    if (prizeElement) {
      const prizeAmount = raffleData.prize_amount || 0;
      const prizeCurrency = raffleData.prize_currency || 'WINIX';
      const winnersCount = raffleData.winners_count || 1;
      prizeElement.textContent = `${prizeAmount} ${prizeCurrency} (${winnersCount} переможців)`;
    }

    // Оновлюємо кількість учасників
    const participantsElement = modal.querySelector('.participants-count');
    if (participantsElement) {
      participantsElement.textContent = raffleData.participants_count || '0';
    }

    // Оновлюємо дату завершення
    const endDateElement = modal.querySelector('.end-time');
    if (endDateElement && raffleData.end_time) {
      try {
        endDateElement.textContent = formatDate(raffleData.end_time);
      } catch (dateError) {
        WinixRaffles.logger.error("Помилка форматування дати:", dateError);
        endDateElement.textContent = 'Дата не вказана';
      }
    }

    // Оновлюємо опис
    const descriptionElement = modal.querySelector('.raffle-description');
    if (descriptionElement) {
      descriptionElement.textContent = raffleData.description ||
        'Використайте жетони для участі та отримайте шанс виграти призи!';
    }

    // Оновлюємо зображення
    const imageElement = modal.querySelector('.prize-image');
    if (imageElement && raffleData.image_url) {
      imageElement.src = raffleData.image_url;
      imageElement.onerror = function() {
        this.src = '/assets/prize-poster.gif';
      };
    }
  }

  /**
   * Оновлення специфічних елементів для щоденного розіграшу
   * @param {HTMLElement} modal - Елемент модального вікна
   * @param {Object} raffleData - Дані розіграшу
   * @private
   */
  _updateDailyRaffleContent(modal, raffleData) {
    // Специфічні оновлення для щоденного розіграшу
    // (Наразі використовуються загальні елементи)
  }

  /**
   * Оновлення специфічних елементів для основного розіграшу
   * @param {HTMLElement} modal - Елемент модального вікна
   * @param {Object} raffleData - Дані розіграшу
   * @private
   */
  _updateMainRaffleContent(modal, raffleData) {
    // Оновлюємо розподіл призів
    const prizeDistributionElement = modal.querySelector('.prize-distribution-list');
    if (prizeDistributionElement && raffleData.prize_distribution) {
      try {
        if (typeof WinixRaffles.utils.generatePrizeDistributionHTML === 'function') {
          prizeDistributionElement.innerHTML = WinixRaffles.utils.generatePrizeDistributionHTML(raffleData.prize_distribution);
        } else {
          // Запасний варіант, якщо функція недоступна
          let distributionHTML = '';
          for (const [place, prize] of Object.entries(raffleData.prize_distribution)) {
            const amount = prize.amount || prize;
            const currency = prize.currency || 'WINIX';
            distributionHTML += `<div class="prize-item"><span class="prize-place">${place} місце:</span> <span class="prize-value">${amount} ${currency}</span></div>`;
          }
          prizeDistributionElement.innerHTML = distributionHTML;
        }
      } catch (error) {
        WinixRaffles.logger.error("Помилка оновлення розподілу призів:", error);
        prizeDistributionElement.innerHTML = '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
      }
    }
  }

  /**
   * Оновлення балансу жетонів у модальному вікні
   * @param {HTMLElement} modal - Елемент модального вікна
   * @param {number} coinsBalance - Баланс жетонів
   * @param {number} tokenCost - Вартість одного токена
   */
  updateTokenBalance(modal, coinsBalance, tokenCost = 1) {
    const balanceElement = modal.querySelector('.token-balance');
    if (balanceElement) {
      balanceElement.textContent = coinsBalance;
    }

    // Оновлюємо максимальне значення вводу
    const tokenInput = modal.querySelector('.token-amount-input');
    if (tokenInput) {
      const maxTokens = Math.floor(coinsBalance / tokenCost);
      tokenInput.max = maxTokens;

      // Якщо поточне значення більше за максимальне, зменшуємо його
      if (parseInt(tokenInput.value) > maxTokens) {
        tokenInput.value = maxTokens;
      }
    }

    // Оновлюємо кнопку "ВСІ"
    const allTokensBtn = modal.querySelector('.all-tokens-btn');
    if (allTokensBtn) {
      if (coinsBalance >= tokenCost) {
        allTokensBtn.style.display = 'inline-block';
      } else {
        allTokensBtn.style.display = 'none';
      }
    }
  }

  /**
   * Встановлення обробників кнопок участі
   * @param {HTMLElement} modal - Елемент модального вікна
   * @param {Function} participateHandler - Обробник участі
   */
  setupParticipationButtons(modal, participateHandler) {
    // Знаходимо кнопку участі
    const joinButton = modal.querySelector('.join-button');
    if (!joinButton) return;

    // Видаляємо старі обробники
    const oldJoinButton = joinButton.cloneNode(true);
    if (joinButton.parentNode) {
      joinButton.parentNode.replaceChild(oldJoinButton, joinButton);
    }

    // Додаємо нові обробники
    oldJoinButton.addEventListener('click', participateHandler);

    // Знаходимо кнопку "ВСІ"
    const allTokensBtn = modal.querySelector('.all-tokens-btn');
    if (allTokensBtn) {
      // Видаляємо старі обробники
      const oldAllButton = allTokensBtn.cloneNode(true);
      if (allTokensBtn.parentNode) {
        allTokensBtn.parentNode.replaceChild(oldAllButton, allTokensBtn);
      }

      // Додаємо нові обробники
      oldAllButton.addEventListener('click', () => {
        const tokenInput = modal.querySelector('.token-amount-input');
        const coinsBalance = parseInt(modal.querySelector('.token-balance')?.textContent || '0');
        const tokenCost = parseInt(modal.getAttribute('data-token-cost') || '1');

        if (tokenInput) {
          tokenInput.value = Math.floor(coinsBalance / tokenCost);
        }
      });
    }
  }

  /**
   * Відображення стану завантаження на кнопці участі
   * @param {HTMLElement} modal - Елемент модального вікна
   * @param {boolean} isLoading - Стан завантаження
   */
  setParticipationLoading(modal, isLoading) {
    const joinButton = modal.querySelector('.join-button');
    if (!joinButton) return;

    if (isLoading) {
      joinButton.disabled = true;
      joinButton.classList.add('loading');
      joinButton.innerHTML = '<span class="spinner"></span> Обробка...';
    } else {
      joinButton.disabled = false;
      joinButton.classList.remove('loading');
      joinButton.textContent = 'Взяти участь';
    }
  }
}

// Приватні змінні
const _transactionManager = new TransactionManager();
const _raffleCache = new RaffleCache();
const _modalManager = new RaffleModalManager();

/**
 * Клас для роботи з участю в розіграшах
 */
class ParticipationModule {
  /**
   * Ініціалізація модуля
   */
  init() {
    WinixRaffles.logger.log("Ініціалізація модуля участі в розіграшах");

    try {
      // Підписуємося на події
      this._setupEventListeners();

      // Встановлюємо інтервали оновлення з конфігурації, якщо потрібно
      this._setupRefreshIntervals();
      
      WinixRaffles.logger.log("Модуль участі в розіграшах ініціалізовано");
      return this;
    } catch (error) {
      WinixRaffles.logger.error("Помилка ініціалізації модуля участі в розіграшах:", error);
      throw error;
    }
  }

  /**
   * Налаштування обробників подій
   * @private
   */
  _setupEventListeners() {
    try {
      // Підписуємося на подію відкриття деталей розіграшу
      WinixRaffles.events.on('open-raffle-details', (data) => {
        if (data && data.raffleId) {
          this.openRaffleDetails(data.raffleId, data.raffleType);
        }
      });

      // Підписуємося на подію поширення розіграшу
      WinixRaffles.events.on('share-raffle', (data) => {
        if (data && data.raffleId) {
          this.shareRaffle(data.raffleId);
        }
      });

      // Підписуємося на подію отримання бонусу новачка
      WinixRaffles.events.on('claim-newbie-bonus', (data) => {
        this.claimNewbieBonus(data?.element, data?.container);
      });

      // Підписуємося на подію оновлення списку розіграшів
      WinixRaffles.events.on('refresh-raffles', (data) => {
        const forceRefresh = data?.force === true;
        this.refreshActiveRaffles(forceRefresh);
      });

      // Підписуємося на події мережі
      WinixRaffles.events.on('network-status-changed', (data) => {
        // Якщо з'єднання відновлено, оновлюємо список розіграшів
        if (data.online) {
          setTimeout(() => this.refreshActiveRaffles(true), 1500);
        }
      });

      // Підписуємося на події помилок API
      WinixRaffles.events.on('api-error', (data) => {
        // Якщо помилка стосується розіграшів
        if (data?.error?.endpoint?.includes('raffles')) {
          WinixRaffles.logger.warn("Виявлено помилку API для розіграшів, оновлюємо список розіграшів");
          setTimeout(() => this.refreshActiveRaffles(true), 1000);
        }
      });
    } catch (error) {
      WinixRaffles.logger.error("Помилка налаштування обробників подій:", error);
    }
  }

  /**
   * Відкриття модального вікна з деталями розіграшу
   * @param {string} raffleId - ID розіграшу
   * @param {string} raffleType - Тип розіграшу
   */
  async openRaffleDetails(raffleId, raffleType) {
    // Створюємо транзакцію для цього процесу
    const transactionId = _transactionManager.generateTransactionId('open_raffle');
    _transactionManager.startTransaction(transactionId, { raffleId, raffleType });

    try {
      // Перевірка валідності ID розіграшу
      if (!RaffleValidator.isValidRaffleId(raffleId)) {
        _transactionManager.addTransactionStep(transactionId, 'validate_id_failed');
        showToast('Невірний формат ID розіграшу', 'error');
        this.refreshActiveRaffles(true);
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'invalid_id' });
        return;
      }

      _transactionManager.addTransactionStep(transactionId, 'validate_id_success');

      // Нормалізуємо тип розіграшу
      raffleType = raffleType || 'main';

      // Перевіряємо наявність з'єднання
      if (!WinixRaffles.network.isOnline()) {
        showToast('Неможливо відкрити деталі розіграшу без підключення до Інтернету', 'warning');
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'offline' });
        return;
      }

      // Перевіряємо наявність жетонів
      _transactionManager.addTransactionStep(transactionId, 'get_user_data');
      showLoading('Перевірка даних користувача...', `${transactionId}_user_data`);

      let userData;
      try {
        userData = await api.getUserData();
        hideLoading(`${transactionId}_user_data`);
      } catch (userError) {
        WinixRaffles.logger.error("Помилка отримання даних користувача:", userError);
        userData = { data: { coins: 0 } };
        hideLoading(`${transactionId}_user_data`);
      }

      const coinsBalance = userData?.data?.coins || 0;
      const tokenCost = raffleType === 'daily' ? 1 : 3;

      _transactionManager.addTransactionStep(transactionId, 'check_balance', { coinsBalance, tokenCost });

      if (coinsBalance < tokenCost) {
        showToast(`Для участі потрібно щонайменше ${tokenCost} жетон${tokenCost > 1 ? 'и' : ''}`, 'warning');
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'insufficient_balance' });
        return;
      }

      // Перевіряємо кеш
      const cachedRaffleData = _raffleCache.getRaffleDetails(raffleId);
      if (cachedRaffleData) {
        WinixRaffles.logger.log(`Використання кешованих даних для розіграшу ${raffleId}`);
        _transactionManager.addTransactionStep(transactionId, 'use_cache');

        // Перевіряємо статус розіграшу
        const statusCheck = RaffleValidator.validateRaffleStatus(cachedRaffleData);
        if (!statusCheck.valid) {
          showToast(statusCheck.message, 'warning');
          _raffleCache.removeRaffle(raffleId);
          this.refreshActiveRaffles(true);
          _transactionManager.completeTransaction(transactionId, 'failure', { reason: statusCheck.code });
          return;
        }

        // Відкриваємо модальне вікно з кешованими даними
        this._showRaffleModal(cachedRaffleData, raffleType, transactionId);
        _transactionManager.completeTransaction(transactionId, 'success', { source: 'cache' });
        return;
      }

      // Отримуємо актуальні дані розіграшу
      _transactionManager.addTransactionStep(transactionId, 'fetch_raffle_data');
      showLoading('Завантаження даних розіграшу...', `${transactionId}_raffle_data`);

      try {
        const raffleData = await this.getRaffleDetails(raffleId);
        hideLoading(`${transactionId}_raffle_data`);

        if (!raffleData) {
          showToast('Не вдалося отримати дані розіграшу', 'error');
          _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'no_data' });
          return;
        }

        // Перевіряємо статус розіграшу
        const statusCheck = RaffleValidator.validateRaffleStatus(raffleData);
        if (!statusCheck.valid) {
          showToast(statusCheck.message, 'warning');
          _raffleCache.removeRaffle(raffleId);
          this.refreshActiveRaffles(true);
          _transactionManager.completeTransaction(transactionId, 'failure', { reason: statusCheck.code });
          return;
        }

        // Відкриваємо модальне вікно
        _transactionManager.addTransactionStep(transactionId, 'show_modal');
        this._showRaffleModal(raffleData, raffleType, transactionId);
        _transactionManager.completeTransaction(transactionId, 'success', { source: 'api' });
      } catch (error) {
        hideLoading(`${transactionId}_raffle_data`);
        WinixRaffles.logger.error('Помилка завантаження деталей розіграшу:', error);
        showToast('Не вдалося завантажити деталі розіграшу. Спробуйте пізніше.', 'error');
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'api_error', error });
      }
    } catch (error) {
      WinixRaffles.logger.error('Помилка відкриття деталей розіграшу:', error);
      showToast('Сталася помилка при відкритті деталей розіграшу', 'error');
      _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'general_error', error });
    }
  }

  /**
   * Відображення модального вікна розіграшу
   * @param {Object} raffleData - Дані розіграшу
   * @param {string} raffleType - Тип розіграшу
   * @param {string} transactionId - ID транзакції
   * @private
   */
  _showRaffleModal(raffleData, raffleType, transactionId) {
    try {
      // Вибираємо ID модального вікна відповідно до типу розіграшу
      const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';

      // Отримуємо баланс жетонів
      const coinsBalance = parseInt(document.getElementById('user-coins')?.textContent || '0');

      // Встановлюємо вартість жетона як атрибут модального вікна
      const tokenCost = raffleType === 'daily' ? 1 : 3;
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.setAttribute('data-token-cost', tokenCost.toString());
        modal.setAttribute('data-raffle-id', raffleData.id);
      }

      // Відкриваємо модальне вікно з даними розіграшу
      const modalElement = _modalManager.openRaffleModal(modalId, raffleData, raffleType);

      if (!modalElement) {
        showToast('Помилка відображення деталей розіграшу', 'error');
        return;
      }

      // Оновлюємо відображення балансу жетонів
      _modalManager.updateTokenBalance(modalElement, coinsBalance, tokenCost);

      // Налаштовуємо кнопки участі
      _modalManager.setupParticipationButtons(modalElement, () => {
        const raffleId = modalElement.getAttribute('data-raffle-id');
        if (!raffleId) {
          WinixRaffles.logger.error("ID розіграшу не знайдено в атрибутах модального вікна");
          return;
        }

        const tokenInput = modalElement.querySelector('.token-amount-input');
        const entryCount = parseInt(tokenInput?.value || '1');

        this.participateInRaffleUI(raffleId, raffleType, entryCount, modalId);
      });

      // Відправляємо подію про відкриття модального вікна
      WinixRaffles.events.emit('raffle-modal-opened', {
        raffleId: raffleData.id,
        raffleType,
        modalId
      });
    } catch (error) {
      WinixRaffles.logger.error('Помилка відображення модального вікна:', error);
      showToast('Сталася помилка при відображенні деталей розіграшу', 'error');
    }
  }

  /**
   * Отримання детальної інформації про розіграш
   * @param {string} raffleId - ID розіграшу
   * @returns {Promise<Object>} Дані про розіграш
   */
  async getRaffleDetails(raffleId) {
    if (!RaffleValidator.isValidRaffleId(raffleId)) {
      return null;
    }

    try {
      // Перевіряємо кеш
      const cachedData = _raffleCache.getRaffleDetails(raffleId);
      if (cachedData) {
        return cachedData;
      }

      // Використовуємо відображення лоадера
      showLoading('Завантаження деталей розіграшу...', `raffle-details-${raffleId}`);

      // Покращені параметри запиту
      const response = await api.apiRequest(`/api/raffles/${raffleId}`, 'GET', null, {
    timeout: CONFIG.API.TIMEOUT,
        suppressErrors: true,
        forceCleanup: true
      });

      // Завжди приховуємо лоадер
      hideLoading(`raffle-details-${raffleId}`);

      if (response && response.status === 'success') {
        // Кешуємо отримані дані
        if (response.data) {
          _raffleCache.setRaffleDetails(raffleId, response.data);
        }
        return response.data;
      }

      // Якщо розіграш не знайдено, видаляємо його з кешу
      _raffleCache.removeRaffle(raffleId);
      throw new Error((response?.message) || 'Помилка отримання деталей розіграшу');
    } catch (error) {
      WinixRaffles.logger.error(`Помилка отримання деталей розіграшу ${raffleId}:`, error);
      hideLoading(`raffle-details-${raffleId}`);
      return null;
    }
  }

  /**
   * Процес участі в розіграші через інтерфейс
   * @param {string} raffleId - ID розіграшу
   * @param {string} raffleType - Тип розіграшу
   * @param {number} entryCount - Кількість жетонів
   * @param {string} modalId - ID модального вікна
   */
  async participateInRaffleUI(raffleId, raffleType, entryCount, modalId) {
    // Створюємо нову транзакцію
    const transactionId = _transactionManager.generateTransactionId('participate');
    _transactionManager.startTransaction(transactionId, { raffleId, raffleType, entryCount });

    try {
      // Перевірка валідності ID розіграшу
      if (!RaffleValidator.isValidRaffleId(raffleId)) {
        showToast('Невірний формат ID розіграшу', 'error');
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'invalid_id' });
        return;
      }

      _transactionManager.addTransactionStep(transactionId, 'validate_id_success');

      // Отримуємо модальне вікно
      const modal = document.getElementById(modalId);
      if (!modal) {
        showToast('Помилка інтерфейсу', 'error');
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'no_modal' });
        return;
      }

      // Встановлюємо стан завантаження
      _modalManager.setParticipationLoading(modal, true);

      // Отримуємо баланс користувача
      _transactionManager.addTransactionStep(transactionId, 'get_user_data');

      let userData;
      try {
        userData = await api.getUserData();
      } catch (userError) {
        WinixRaffles.logger.error("Помилка отримання даних користувача:", userError);
        userData = { data: { coins: 0 } };
      }

      const coinsBalance = userData?.data?.coins || 0;
      const tokenCost = raffleType === 'daily' ? 1 : 3;

      // Валідуємо кількість жетонів
      _transactionManager.addTransactionStep(transactionId, 'validate_entry_count');

      const validation = RaffleValidator.validateEntryCount(entryCount, coinsBalance, tokenCost);
      if (!validation.valid) {
        _modalManager.setParticipationLoading(modal, false);
        showToast(validation.message, 'warning');
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: validation.code });
        return;
      }

      // Показуємо підтвердження, якщо кількість жетонів більше 5
      if (entryCount > 5) {
        _transactionManager.addTransactionStep(transactionId, 'confirmation_required');

        try {
          const confirmed = await showConfirm(
            `Ви впевнені, що хочете використати ${entryCount} жетонів для участі в цьому розіграші?`,
            'Так, взяти участь',
            'Скасувати'
          );

          if (!confirmed) {
            _modalManager.setParticipationLoading(modal, false);
            _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'user_cancelled' });
            return;
          }
        } catch (confirmError) {
          WinixRaffles.logger.error("Помилка показу підтвердження:", confirmError);
          // Продовжуємо без підтвердження у випадку помилки
        }
      }

      // Перевіряємо актуальність розіграшу
      _transactionManager.addTransactionStep(transactionId, 'check_raffle_active');
      showLoading('Перевірка статусу розіграшу...', `${transactionId}_check`);

      try {
        const raffleCheck = await api.apiRequest(`/api/raffles/${raffleId}`, 'GET', null, {
          suppressErrors: true,
          timeout: 5000
        });

        hideLoading(`${transactionId}_check`);

        // Перевіряємо статус розіграшу
        if (!raffleCheck || raffleCheck.status === 'error' ||
            (raffleCheck.data && raffleCheck.data.status !== 'active')) {
          _modalManager.setParticipationLoading(modal, false);
          _modalManager.closeModal(modalId);

          showToast('Цей розіграш недоступний або вже завершений', 'warning');

          // Оновлюємо список активних розіграшів
          this.refreshActiveRaffles(true);

          _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'inactive_raffle' });
          return;
        }
      } catch (checkError) {
        hideLoading(`${transactionId}_check`);
        WinixRaffles.logger.error("Помилка перевірки статусу розіграшу:", checkError);
        // Продовжуємо, навіть якщо не вдалося перевірити статус
      }

      // Беремо участь у розіграші
      _transactionManager.addTransactionStep(transactionId, 'participate');

      const result = await this.participateInRaffle(raffleId, entryCount);

      // Знімаємо стан завантаження
      _modalManager.setParticipationLoading(modal, false);

      if (result && result.status === 'success') {
        // Закриваємо модальне вікно
        _modalManager.closeModal(modalId);

        // Оновлюємо баланс користувача негайно
        await this.updateUserBalance();

        // Показуємо повідомлення про успіх
        showToast(result.message || 'Ви успішно взяли участь у розіграші', 'success');

        // Оновлюємо дані в кеші
        const raffleData = _raffleCache.getRaffleDetails(raffleId);
        if (raffleData) {
          raffleData.participants_count = (parseInt(raffleData.participants_count) || 0) + 1;
          _raffleCache.setRaffleDetails(raffleId, raffleData);

          // Оновлюємо відображення кількості учасників на сторінці
          const participantsElements = document.querySelectorAll(`[data-raffle-id="${raffleId}"] .participants-count`);
          participantsElements.forEach(element => {
            element.textContent = raffleData.participants_count;
          });
        }

        // Сповіщаємо інші модулі про успішну участь
        WinixRaffles.events.emit('raffle-participated', {
          raffleId,
          entryCount,
          tokenCost,
          totalCost: entryCount * tokenCost,
          timestamp: Date.now()
        });

        // Якщо є бонус, показуємо повідомлення про нього
        if (result.data?.bonus_amount) {
          setTimeout(() => {
            showToast(`Вітаємо! Ви отримали ${result.data.bonus_amount} WINIX як бонус!`, 'success');
          }, 1500);
        }

        _transactionManager.completeTransaction(transactionId, 'success', result);
      } else {
        // Показуємо повідомлення про помилку
        showToast(result?.message || 'Помилка участі в розіграші', 'error');

        // Якщо помилка пов'язана з неіснуючим розіграшем
        if (result?.message && (
            result.message.includes('не знайдено') ||
            result.message.includes('не існує') ||
            result.message.includes('невалідний') ||
            result.message.includes('завершено')
        )) {
          _modalManager.closeModal(modalId);
          this.refreshActiveRaffles(true);
          _raffleCache.removeRaffle(raffleId);
        }

        _transactionManager.completeTransaction(transactionId, 'failure', result);
      }
    } catch (error) {
      WinixRaffles.logger.error('Помилка при участі в розіграші:', error);

      // Відновлюємо інтерфейс
      const modal = document.getElementById(modalId);
      if (modal) {
        _modalManager.setParticipationLoading(modal, false);
      }

      showToast('Сталася помилка при участі в розіграші. Спробуйте пізніше.', 'error');
      _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'general_error', error });
    }
  }

  /**
   * Участь у розіграші
   * @param {string} raffleId - ID розіграшу
   * @param {number} entryCount - Кількість жетонів для участі
   * @returns {Promise<Object>} Результат участі
   */
  async participateInRaffle(raffleId, entryCount = 1) {
    // Створюємо транзакцію для цього процесу
    const transactionId = _transactionManager.generateTransactionId('participate_api');
    _transactionManager.startTransaction(transactionId, { raffleId, entryCount });

    try {
      // Валідація даних
      if (!RaffleValidator.isValidRaffleId(raffleId)) {
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'invalid_uuid' });
        return {
          status: 'error',
          message: 'Недійсний ідентифікатор розіграшу',
          code: 'invalid_uuid'
        };
      }

      // Перевірка на коректність entryCount
      if (typeof entryCount !== 'number' || isNaN(entryCount) || entryCount <= 0 || !Number.isInteger(entryCount)) {
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'invalid_entry_count' });
        return {
          status: 'error',
          message: 'Кількість жетонів має бути додатним цілим числом',
          code: 'invalid_entry_count'
        };
      }

      // Перевірка мережевого з'єднання
      if (!WinixRaffles.network.isOnline()) {
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'offline' });
        return {
          status: 'error',
          message: 'Немає з\'єднання з мережею',
          code: 'offline'
        };
      }

      // Використовуємо централізоване відображення лоадера
      showLoading('Беремо участь у розіграші...', `participate-${raffleId}`);

      const userId = api.getUserId();
      if (!userId) {
        hideLoading(`participate-${raffleId}`);
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'no_user_id' });
        return {
          status: 'error',
          message: 'ID користувача не знайдено',
          code: 'no_user_id'
        };
      }

      // Додаємо унікальний ідентифікатор до запиту для запобігання кешуванню
      const timestamp = Date.now();
      const participationData = {
        raffle_id: raffleId,
        entry_count: entryCount,
        timestamp
      };

      // Покращені параметри запиту
      _transactionManager.addTransactionStep(transactionId, 'api_request');

      const response = await api.apiRequest(`/api/user/${userId}/participate-raffle?t=${timestamp}`, 'POST',
        participationData,
        {
          timeout: 15000,
          suppressErrors: true,
          forceCleanup: true
        }
      );

      // Завжди приховуємо лоадер
      hideLoading(`participate-${raffleId}`);

      if (response && response.status === 'success') {
        // Додаємо в кеш інформацію про участь
        const raffleData = _raffleCache.getRaffleDetails(raffleId);
        if (raffleData) {
          raffleData.participants_count = (parseInt(raffleData.participants_count) || 0) + 1;
          raffleData.user_participation = true;
          _raffleCache.setRaffleDetails(raffleId, raffleData);
        }

        // Оновлюємо баланс користувача в localStorage
        const newBalance = response.data?.new_coins_balance;
        if (newBalance !== undefined) {
          try {
            localStorage.setItem('userCoins', String(Math.round(newBalance)));
            localStorage.setItem('winix_coins', String(Math.round(newBalance)));
          } catch(e) {}
        }

        _transactionManager.completeTransaction(transactionId, 'success', response.data);

        return {
          status: 'success',
          message: response.data?.message || 'Ви успішно взяли участь у розіграші',
          data: response.data
        };
      }

      // Обробка помилки
      _transactionManager.completeTransaction(transactionId, 'failure', {
        reason: 'api_error',
        message: response?.message
      });

      return {
        status: 'error',
        message: response?.message || 'Помилка участі в розіграші',
        code: response?.code || 'api_error'
      };
    } catch (error) {
      WinixRaffles.logger.error(`Помилка участі в розіграші ${raffleId}:`, error);

      // Завжди приховуємо лоадер
      hideLoading(`participate-${raffleId}`);

      _transactionManager.completeTransaction(transactionId, 'failure', {
        reason: 'exception',
        error: error.message
      });

      return {
        status: 'error',
        message: error.message || 'Невідома помилка при участі в розіграші',
        code: 'exception'
      };
    }
  }

  /**
   * Примусове оновлення списку розіграшів
   * @param {boolean} forceRefresh - Примусове оновлення
   * @returns {Promise<Array>} Список ID активних розіграшів
   */
  async refreshActiveRaffles(forceRefresh = false) {
    try {
      showLoading('Оновлення списку розіграшів...', 'refresh-raffles');

      // Очищаємо кеш, якщо потрібне примусове оновлення
      if (forceRefresh) {
        _raffleCache.clearAll();
      }

      // Отримуємо оновлений список розіграшів
      const response = await api.apiRequest('/api/raffles', 'GET', null, {
        forceRefresh: true,
        timeout: 10000,
        suppressErrors: true
      });

      hideLoading('refresh-raffles');

      if (response && response.status === 'success' && response.data) {
        // Зберігаємо активні ID розіграшів
        const activeRaffleIds = response.data.map(raffle => raffle.id);
        _raffleCache.updateActiveRaffles(activeRaffleIds);

        WinixRaffles.logger.log(`Отримано ${activeRaffleIds.length} активних розіграшів`);

        // Оповіщаємо про оновлення списку розіграшів
        WinixRaffles.events.emit('raffles-updated', {
          count: activeRaffleIds.length,
          timestamp: Date.now()
        });

        showToast(`Список розіграшів оновлено (${activeRaffleIds.length})`, 'success');
        return activeRaffleIds;
      }

      return [];
    } catch (error) {
      WinixRaffles.logger.error('Помилка оновлення списку розіграшів:', error);
      hideLoading('refresh-raffles');
      showToast('Не вдалося оновити список розіграшів', 'error');
      return [];
    }
  }

  /**
   * Поділитися розіграшем
   * @param {string} raffleId - ID розіграшу
   */
  async shareRaffle(raffleId) {
    try {
      // Перевірка валідності ID розіграшу
      if (!RaffleValidator.isValidRaffleId(raffleId)) {
        showToast('Неможливо поділитися - невірний формат ID розіграшу', 'error');
        return;
      }

      // Перевіряємо наявність розіграшу
      let raffleData = _raffleCache.getRaffleDetails(raffleId);

      // Якщо немає в кеші, отримуємо з API
      if (!raffleData) {
        showLoading('Завантаження даних розіграшу...', 'share-raffle');

        try {
          raffleData = await this.getRaffleDetails(raffleId);
          hideLoading('share-raffle');

          if (!raffleData) {
            showToast('Не вдалося завантажити дані розіграшу для поширення', 'error');
            return;
          }
        } catch (error) {
          hideLoading('share-raffle');
          showToast('Помилка отримання даних розіграшу', 'error');
          return;
        }
      }

      // Безпечно отримуємо поля розіграшу
      const title = raffleData.title || 'Розіграш';
      const prizeAmount = raffleData.prize_amount || 0;
      const prizeCurrency = raffleData.prize_currency || 'WINIX';
      const winnersCount = raffleData.winners_count || 1;

      // Формуємо повідомлення для поширення
      const shareText = `🎮 Розіграш WINIX: ${title}\n\n` +
                       `💰 Призовий фонд: ${prizeAmount} ${prizeCurrency}\n` +
                       `🏆 Кількість переможців: ${winnersCount}\n\n` +
                       `Бери участь і вигравай призи! 🚀`;

      // Перевіряємо наявність Telegram WebApp
      if (window.Telegram && window.Telegram.WebApp) {
        try {
          // Використовуємо метод Telegram для поширення
          if (typeof window.Telegram.WebApp.switchInlineQuery === 'function') {
            window.Telegram.WebApp.switchInlineQuery(shareText, ['users', 'groups']);
            return;
          }
        } catch (telegramError) {
          WinixRaffles.logger.warn('Помилка використання Telegram WebApp:', telegramError);
        }
      }

      // Запасний варіант - Web Share API
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Розіграш WINIX: ${title}`,
            text: shareText
          });
          showToast('Розіграш успішно поширено', 'success');
          return;
        } catch (shareError) {
          // Користувач відмінив поширення або сталася помилка
          if (shareError.name !== 'AbortError') {
            WinixRaffles.logger.error('Помилка поширення:', shareError);
          }
        }
      }

      // Останній запасний варіант - копіювання в буфер обміну
      if (typeof copyToClipboard === 'function') {
        await copyToClipboard(shareText);
        showToast('Текст розіграшу скопійовано в буфер обміну', 'success');
      } else {
        showToast('Не вдалося поділитися розіграшем', 'error');
      }
    } catch (error) {
      WinixRaffles.logger.error('Помилка поширення розіграшу:', error);
      showToast('Не вдалося поділитися розіграшем', 'error');
    }
  }

  /**
   * Отримання бонусу новачка
   * @param {HTMLElement} [button] - Кнопка бонусу новачка
   * @param {HTMLElement} [container] - Контейнер елементу бонусу
   * @returns {Promise<Object>} Результат отримання бонусу
   */
  async claimNewbieBonus(button, container) {
    // Створюємо транзакцію для цього процесу
    const transactionId = _transactionManager.generateTransactionId('claim_bonus');
    _transactionManager.startTransaction(transactionId, {});

    try {
      showLoading('Отримуємо бонус новачка...', 'newbie-bonus');

      if (!WinixRaffles.network.isOnline()) {
        hideLoading('newbie-bonus');
        showToast('Неможливо отримати бонус без підключення до Інтернету', 'warning');
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'offline' });
        return {
          status: 'error',
          message: 'Немає з\'єднання з мережею',
          code: 'offline'
        };
      }

      const userId = api.getUserId();
      if (!userId) {
        hideLoading('newbie-bonus');
        _transactionManager.completeTransaction(transactionId, 'failure', { reason: 'no_user_id' });
        return {
          status: 'error',
          message: 'ID користувача не знайдено',
          code: 'no_user_id'
        };
      }

      // Покращені параметри запиту
      _transactionManager.addTransactionStep(transactionId, 'api_request');

      const response = await api.apiRequest(`/api/user/${userId}/claim-newbie-bonus`, 'POST', null, {
        timeout: 10000,
        suppressErrors: true
      });

      hideLoading('newbie-bonus');

      if (response && (response.status === 'success' || response.status === 'already_claimed')) {
        // Оновлюємо баланс користувача
        await this.updateUserBalance();

        if (response.status === 'success') {
          showToast(`Ви отримали ${response.data?.amount || 500} WINIX як бонус новачка!`, 'success');

          // Деактивуємо кнопку, якщо вона передана
          if (button) {
            button.textContent = 'Отримано';
            button.disabled = true;
            button.style.opacity = '0.6';
            button.style.cursor = 'default';
          }

          // Додаємо водяний знак, якщо контейнер переданий
          if (container && WinixRaffles.utils.markElement) {
            WinixRaffles.utils.markElement(container);
          }

          // Зберігаємо статус отримання бонусу
          try {
            localStorage.setItem('newbie_bonus_claimed', 'true');
          } catch (e) {}

          // Відправляємо подію про отримання бонусу
          WinixRaffles.events.emit('newbie-bonus-claimed', {
            amount: response.data?.amount || 500,
            timestamp: Date.now()
          });
        } else {
          showToast('Ви вже отримали бонус новачка', 'info');

          // Деактивуємо кнопку, якщо вона передана
          if (button) {
            button.textContent = 'Отримано';
            button.disabled = true;
            button.style.opacity = '0.6';
            button.style.cursor = 'default';
          }

          // Додаємо водяний знак, якщо контейнер переданий
          if (container && WinixRaffles.utils.markElement) {
            WinixRaffles.utils.markElement(container);
          }

          // Зберігаємо статус отримання бонусу
          try {
            localStorage.setItem('newbie_bonus_claimed', 'true');
          } catch (e) {}
        }

        _transactionManager.completeTransaction(transactionId, 'success', response);

        return {
          status: response.status,
          message: response.message || 'Бонус новачка успішно отримано',
          data: response.data
        };
      }

      // Обробка помилки
      _transactionManager.completeTransaction(transactionId, 'failure', {
        reason: 'api_error',
        message: response?.message
      });

      showToast(response?.message || 'Помилка отримання бонусу новачка', 'error');

      return {
        status: 'error',
        message: response?.message || 'Помилка отримання бонусу новачка',
        code: response?.code || 'api_error'
      };
    } catch (error) {
      WinixRaffles.logger.error('Помилка отримання бонусу новачка:', error);
      hideLoading('newbie-bonus');

      showToast(error.message || 'Помилка отримання бонусу новачка', 'error');

      _transactionManager.completeTransaction(transactionId, 'failure', {
        reason: 'exception',
        error: error.message
      });

      return {
        status: 'error',
        message: error.message || 'Невідома помилка при отриманні бонусу',
        code: 'exception'
      };
    }
  }

  /**
   * Оновлення балансу користувача
   * @returns {Promise<boolean>} Результат оновлення
   */
  async updateUserBalance() {
    try {
      // Найоптимальніший шлях - через глобальний API
      if (api && typeof api.getBalance === 'function') {
        const balanceData = await api.getBalance(true);

        if (balanceData && balanceData.status === 'success') {
          // Оновлюємо елементи інтерфейсу
          const coinsElement = document.getElementById('user-coins');
          const tokensElement = document.getElementById('user-tokens');

          if (coinsElement && balanceData.data.coins !== undefined) {
            coinsElement.textContent = Math.round(balanceData.data.coins);
          }

          if (tokensElement && balanceData.data.balance !== undefined) {
            tokensElement.textContent = Math.round(balanceData.data.balance);
          }

          return true;
        }
      }

      // Альтернативний шлях через getUserData
      const userData = await api.getUserData(true);

      if (userData && userData.data) {
        // Оновлюємо елементи інтерфейсу
        const coinsElement = document.getElementById('user-coins');
        const tokensElement = document.getElementById('user-tokens');

        if (coinsElement && userData.data.coins !== undefined) {
          coinsElement.textContent = Math.round(userData.data.coins);
        }

        if (tokensElement && userData.data.balance !== undefined) {
          tokensElement.textContent = Math.round(userData.data.balance);
        }
      }

      return true;
    } catch (error) {
      WinixRaffles.logger.error('Помилка оновлення балансу:', error);
      return false;
    } finally {
      // Відправляємо подію про оновлення балансу
      WinixRaffles.events.emit('balance-updated', {
        timestamp: Date.now()
      });
    }
  }
/**
 * Оновлення даних модуля
 * @param {boolean} [forceRefresh=false] Примусове оновлення
 * @returns {Promise<boolean>} Результат оновлення
 */
async refresh(forceRefresh = false) {
  try {
    WinixRaffles.logger.log("Оновлення даних модуля участі");

    // Оновлюємо активні розіграші
    const result = await this.refreshActiveRaffles(forceRefresh);

    return true;
  } catch (error) {
    WinixRaffles.logger.error("Помилка оновлення даних модуля участі:", error);
    return false;
  }
}
  /**
   * Очищення ресурсів і кешу при знищенні модуля
   */
  destroy() {
    try {
      // Закриваємо всі модальні вікна
      _modalManager.closeAllModals();

      // Очищаємо всі активні транзакції
      _transactionManager.clearAllTransactions();

      // Очищаємо кеш
      _raffleCache.clearAll();

      WinixRaffles.logger.log("Модуль участі в розіграшах закрито");
    } catch (error) {
      WinixRaffles.logger.error("Помилка при знищенні модуля участі в розіграшах:", error);
    }
  }
}

// Створюємо екземпляр класу
const participationModule = new ParticipationModule();

// Оновлюємо експорт для єдиної системи
export default {
  /**
   * Ініціалізація модуля участі
   */
  init: async function() {
    try {
      await participationModule.init();

      // Експортуємо методи для зворотної сумісності
      WinixRaffles.participation = participationModule;

      // Реєструємо модуль в системі WinixRaffles (для нової архітектури)
      if (typeof WinixRaffles.registerModule === 'function') {
        WinixRaffles.registerModule('participation', {
          init: participationModule.init.bind(participationModule),
          refresh: participationModule.refresh.bind(participationModule),
          openRaffleDetails: participationModule.openRaffleDetails.bind(participationModule),
          participateInRaffle: participationModule.participateInRaffle.bind(participationModule),
          refreshActiveRaffles: participationModule.refreshActiveRaffles.bind(participationModule),
          destroy: participationModule.destroy.bind(participationModule)
        });
      }

      return participationModule;
    } catch (error) {
      WinixRaffles.logger.error("Помилка ініціалізації модуля участі:", error);
      throw error;
    }
  },

  /**
   * Метод оновлення даних
   * @param {boolean} [forceRefresh=false] Примусове оновлення
   * @returns {Promise<boolean>} Результат оновлення
   */
  refresh: function(forceRefresh = false) {
    return participationModule.refresh(forceRefresh);
  },

  /**
   * Знищення модуля
   */
  destroy: function() {
    participationModule.destroy();
  }
};