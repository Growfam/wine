/**
 * WINIX - Система розіграшів (participation.js) - Спрощена та оптимізована версія
 * Виправлено проблеми з рекурсією, Memory leaks та балансом
 * @version 4.0.0
 */

(function () {
  'use strict';

  // Перевірка наявності головного модуля розіграшів
  if (typeof window.WinixRaffles === 'undefined') {
    console.error(
      '❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше participation.js'
    );
    return;
  }

  // Трекер показаних сповіщень для запобігання дублюванню
  const shownNotifications = new Set();

  // Підмодуль для участі в розіграшах
  const participation = {
    // Налаштування
    MIN_REQUEST_INTERVAL: 2000, // мінімальний інтервал між запитами (мс)
    REQUEST_TIMEOUT: 15000, // таймаут запиту (мс)

    // Стан модуля
    participatingRaffles: new Set(), // розіграші, в яких користувач бере участь
    userRaffleTickets: {}, // кількість білетів користувача для кожного розіграшу
    invalidRaffleIds: new Set(), // недійсні розіграші
    lastRequestTimes: {}, // час останнього запиту для кожного розіграшу
    lastKnownBalance: null, // останній відомий баланс
    lastBalanceUpdateTime: 0, // час останнього оновлення балансу

    // Блокування
    requestInProgress: false, // прапорець виконання запиту
    syncInProgress: false, // прапорець синхронізації
    lastSyncTime: 0, // час останньої синхронізації

    // Ідентифікатори таймерів
    syncTimer: null, // таймер синхронізації
    serverCheckTimer: null, // таймер перевірки стану сервера

    /**
     * Ініціалізація модуля
     */
    init: function () {
      console.log('🎯 Ініціалізація модуля участі в розіграшах...');

      // Очищення стану
      this._cleanupState();

      // Завантаження даних
      this._loadUserParticipation();

      // Налаштування подій
      this._setupEventHandlers();

      console.log('✅ Модуль участі в розіграшах успішно ініціалізовано');
    },

    /**
     * Очищення стану
     * @private
     */
    _cleanupState: function () {
      // Очищення таймерів
      if (this.syncTimer) {
        clearTimeout(this.syncTimer);
        this.syncTimer = null;
      }

      if (this.serverCheckTimer) {
        clearInterval(this.serverCheckTimer);
        this.serverCheckTimer = null;
      }

      this.requestInProgress = false;
      this.syncInProgress = false;

      // Відновлення стану кнопок
      document
        .querySelectorAll('.join-button.processing, .mini-raffle-button.processing')
        .forEach((button) => {
          button.classList.remove('processing');
          button.disabled = false;

          // Відновлюємо текст
          const originalText = button.getAttribute('data-original-text');
          if (originalText) {
            button.textContent = originalText;
          } else {
            const entryFee = button.getAttribute('data-entry-fee') || '1';
            button.textContent = button.classList.contains('mini-raffle-button')
              ? 'Взяти участь'
              : `Взяти участь за ${entryFee} жетон${parseInt(entryFee) > 1 ? 'и' : ''}`;
          }
        });
    },

    /**
     * Завантаження даних про участь користувача
     * @private
     */
    _loadUserParticipation: function () {
      // Відновлення з localStorage
      try {
        const savedState = localStorage.getItem('winix_participation_state');
        if (savedState) {
          const parsedState = JSON.parse(savedState);

          // Перевірка актуальності даних (не старіші 30 хвилин)
          if (parsedState && parsedState.lastUpdate) {
            const now = Date.now();
            const cacheAge = now - parsedState.lastUpdate;

            if (cacheAge < 30 * 60 * 1000) {
              if (Array.isArray(parsedState.raffles)) {
                this.participatingRaffles = new Set(parsedState.raffles);
              }

              if (parsedState.tickets) {
                this.userRaffleTickets = parsedState.tickets;
              }

              if (parsedState.balance !== undefined) {
                this.lastKnownBalance = parsedState.balance;
                this.lastBalanceUpdateTime = parsedState.lastBalanceUpdateTime || now;
              }

              console.log('✅ Успішно відновлено дані про участь із локального сховища');
            }
          }
        }

        // Відновлення списку невалідних розіграшів
        const invalidRaffles = localStorage.getItem('winix_invalid_raffles');
        if (invalidRaffles) {
          try {
            this.invalidRaffleIds = new Set(JSON.parse(invalidRaffles));
          } catch (e) {
            console.warn('⚠️ Помилка відновлення списку недійсних розіграшів:', e);
          }
        }
      } catch (error) {
        console.error('❌ Помилка відновлення даних про участь:', error);
      }

      // Завантаження даних з сервера
      this.loadUserRaffles();
    },

    /**
     * Налаштування обробників подій
     * @private
     */
    _setupEventHandlers: function () {
      // Обробник кліків на кнопки участі
      document.addEventListener('click', (event) => {
        const participateButton = event.target.closest('.join-button, .mini-raffle-button');

        if (
          participateButton &&
          !participateButton.disabled &&
          !participateButton.classList.contains('processing')
        ) {
          const raffleId = participateButton.getAttribute('data-raffle-id');
          if (!raffleId) return;

          event.preventDefault();

          // Перевірка на часті кліки
          const now = Date.now();
          const lastRequestTime = this.lastRequestTimes[raffleId] || 0;
          if (now - lastRequestTime < this.MIN_REQUEST_INTERVAL) {
            this._showToast('Будь ласка, зачекайте перед наступною спробою', 'info');
            return;
          }

          // Перевірка стану
          if (this.requestInProgress) {
            this._showToast('Зачекайте завершення попереднього запиту', 'warning');
            return;
          }

          // Визначаємо тип розіграшу
          const raffleType = participateButton.classList.contains('mini-raffle-button')
            ? 'daily'
            : 'main';

          // Встановлюємо стан кнопки
          participateButton.classList.add('processing');
          participateButton.disabled = true;

          // Зберігаємо оригінальний текст кнопки
          if (!participateButton.getAttribute('data-original-text')) {
            participateButton.setAttribute('data-original-text', participateButton.textContent);
          }

          // Змінюємо текст
          participateButton.textContent = 'Обробка...';

          // Спроба участі
          this.participateInRaffle(raffleId, raffleType)
            .then((result) => {
              if (result.success) {
                console.log(`✅ Успішна участь у розіграші ${raffleId}`);
              } else {
                console.warn(`⚠️ Помилка участі: ${result.message}`);

                // Відновлюємо стан кнопки
                this._resetButtonState(raffleId);

                // Показуємо повідомлення про помилку
                this._showToast(result.message, 'warning');
              }
            })
            .catch((error) => {
              console.error('❌ Помилка участі в розіграші:', error);

              // Відновлюємо стан кнопки
              this._resetButtonState(raffleId);

              // Показуємо повідомлення про помилку
              this._showToast(error.message || 'Помилка при спробі участі в розіграші', 'error');
            });
        }
      });

      // Обробник події зміни видимості сторінки
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // При поверненні на вкладку перевіряємо стан
          if (this.requestInProgress && Date.now() - this.lastRequestTime > 15000) {
            console.warn(
              '⚠️ Виявлено активний стан requestInProgress після повернення на сторінку. Скидаємо стан.'
            );
            this.requestInProgress = false;
          }

          // Якщо давно не оновлювали, завантажуємо свіжі дані
          const now = Date.now();
          if (now - this.lastSyncTime > 30000) {
            setTimeout(() => {
              this.loadUserRaffles(true);
              this.lastSyncTime = now;
            }, 1000);
          }
        }
      });
    },

    /**
     * Показ сповіщення без дублювання
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип повідомлення (info, warning, error, success)
     * @private
     */
    _showToast: function (message, type = 'info') {
      if (typeof window.showToast !== 'function') return;

      // Створюємо унікальний ключ для повідомлення
      const messageKey = message + (type || '');

      // Перевіряємо, чи не показували це повідомлення нещодавно
      if (shownNotifications.has(messageKey)) {
        return;
      }

      // Додаємо до списку показаних
      shownNotifications.add(messageKey);

      // Видаляємо зі списку через 5 секунд
      setTimeout(() => {
        shownNotifications.delete(messageKey);
      }, 5000);

      // Показуємо повідомлення
      window.showToast(message, type);
    },

    /**
     * Генерація унікального ID транзакції
     * @returns {string} Унікальний ID
     * @private
     */
    _generateTransactionId: function () {
      return 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    },

    /**
     * Отримання поточної кількості жетонів
     * @returns {number} Кількість жетонів
     * @private
     */
    _getCurrentCoins: function () {
      // З DOM
      const userCoinsElement = document.getElementById('user-coins');
      if (userCoinsElement) {
        return parseInt(userCoinsElement.textContent) || 0;
      }

      // З кешу
      if (this.lastKnownBalance !== null) {
        return this.lastKnownBalance;
      }

      // З localStorage
      return (
        parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins')) || 0
      );
    },

    /**
     * Збереження даних про участь у localStorage
     * @private
     */
    _saveParticipationToStorage: function () {
      try {
        const participationState = {
          raffles: Array.from(this.participatingRaffles),
          tickets: this.userRaffleTickets,
          lastUpdate: Date.now(),
          balance: this.lastKnownBalance,
          lastBalanceUpdateTime: this.lastBalanceUpdateTime,
        };

        localStorage.setItem('winix_participation_state', JSON.stringify(participationState));

        // Збереження списку недійсних розіграшів
        localStorage.setItem(
          'winix_invalid_raffles',
          JSON.stringify(Array.from(this.invalidRaffleIds))
        );
      } catch (error) {
        console.warn('⚠️ Помилка збереження даних про участь:', error);
      }
    },

    /**
     * Скидання стану кнопки участі
     * @param {string} raffleId - ID розіграшу
     * @private
     */
    _resetButtonState: function (raffleId) {
      const buttons = document.querySelectorAll(
        `.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`
      );

      buttons.forEach((button) => {
        // Видаляємо клас обробки
        button.classList.remove('processing');
        button.removeAttribute('data-processing');
        button.disabled = false;

        // Перевіряємо участь
        const isParticipating = this.participatingRaffles.has(raffleId);

        if (isParticipating) {
          // Якщо користувач уже бере участь
          const ticketCount = this.userRaffleTickets[raffleId] || 1;
          const isMini = button.classList.contains('mini-raffle-button');

          button.textContent = isMini
            ? `Додати ще білет (${ticketCount})`
            : `Додати ще білет (у вас: ${ticketCount})`;

          button.classList.add('participating');
        } else {
          // Відновлюємо оригінальний текст
          const originalText = button.getAttribute('data-original-text');

          if (originalText) {
            button.textContent = originalText;
          } else {
            const entryFee = button.getAttribute('data-entry-fee') || '1';
            button.textContent = button.classList.contains('mini-raffle-button')
              ? 'Взяти участь'
              : `Взяти участь за ${entryFee} жетон${parseInt(entryFee) > 1 ? 'и' : ''}`;
          }

          button.classList.remove('participating');
        }
      });
    },

    /**
     * Завантаження розіграшів з участю користувача
     * @param {boolean} forceRefresh - Примусове оновлення
     * @returns {Promise<Object>} Результат завантаження
     */
    loadUserRaffles: async function (forceRefresh = false) {
      // Перевірка стану
      if (this.syncInProgress && !forceRefresh) {
        console.log('⏳ Синхронізація вже виконується');
        return { success: false, message: 'Синхронізація вже виконується' };
      }

      // Захист від частих запитів
      const now = Date.now();
      if (!forceRefresh && now - this.lastSyncTime < 5000) {
        console.log('⏳ Занадто часте оновлення, пропускаємо запит');
        return { success: true, message: 'Дані нещодавно оновлено' };
      }

      this.syncInProgress = true;

      try {
        // Отримання ID користувача
        const userId = this._getUserId();

        if (!userId) {
          console.warn('⚠️ Не вдалося визначити ID користувача для завантаження розіграшів');
          return { success: false, message: 'Не вдалося визначити ID користувача' };
        }

        // Перевірка наявності API
        if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
          console.warn('⚠️ WinixAPI.apiRequest не доступний');
          return { success: false, message: 'API недоступний' };
        }

        // Запит до API
        const response = await window.WinixAPI.apiRequest(
          `user/${userId}/raffles?nocache=${now}`,
          'GET',
          null,
          {
            suppressErrors: true,
            hideLoader: true,
            timeout: 10000,
            allowParallel: true,
            retries: 1,
          }
        );

        if (response && response.status === 'success' && Array.isArray(response.data)) {
          // Оновлюємо дані
          this.participatingRaffles.clear();
          this.userRaffleTickets = {};

          // Заповнюємо з відповіді сервера
          response.data.forEach((raffle) => {
            if (raffle.raffle_id) {
              this.participatingRaffles.add(raffle.raffle_id);
              this.userRaffleTickets[raffle.raffle_id] = raffle.entry_count || 1;
            }
          });

          console.log(`✅ Користувач бере участь у ${this.participatingRaffles.size} розіграшах`);

          // Зберігаємо дані в localStorage
          this._saveParticipationToStorage();

          // Оновлюємо час останньої синхронізації
          this.lastSyncTime = now;

          // Оновлюємо кнопки участі
          this.updateParticipationButtons();

          return {
            success: true,
            data: {
              rafflesCount: this.participatingRaffles.size,
              raffles: Array.from(this.participatingRaffles),
            },
          };
        } else {
          console.warn(
            `⚠️ Помилка завантаження розіграшів: ${response?.message || 'Невідома помилка'}`
          );
          return {
            success: false,
            message: response?.message || 'Помилка завантаження даних',
          };
        }
      } catch (error) {
        console.error('❌ Помилка завантаження розіграшів користувача:', error);
        return {
          success: false,
          message: error.message || 'Не вдалось завантажити дані про участь',
        };
      } finally {
        this.syncInProgress = false;
      }
    },

    /**
     * Отримання ID користувача
     * @returns {string|null} ID користувача
     * @private
     */
    _getUserId: function () {
      // З WinixRaffles
      if (
        window.WinixRaffles &&
        window.WinixRaffles.state &&
        window.WinixRaffles.state.telegramId
      ) {
        return window.WinixRaffles.state.telegramId;
      }

      // З WinixAPI
      if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
        return window.WinixAPI.getUserId();
      }

      // З WinixCore
      if (window.WinixCore && typeof window.WinixCore.getUserId === 'function') {
        return window.WinixCore.getUserId();
      }

      // З localStorage
      return localStorage.getItem('telegram_user_id');
    },

    /**
     * Оновлення відображення кнопок участі
     */
    updateParticipationButtons: function () {
      try {
        // Отримуємо всі кнопки участі
        const buttons = document.querySelectorAll('.join-button, .mini-raffle-button');
        if (!buttons.length) return;

        // Кешуємо стани для оптимізації
        const participatingCache = {};
        this.participatingRaffles.forEach((id) => {
          participatingCache[id] = true;
        });

        const invalidCache = {};
        this.invalidRaffleIds.forEach((id) => {
          invalidCache[id] = true;
        });

        // Обробляємо кожну кнопку
        buttons.forEach((button) => {
          const raffleId = button.getAttribute('data-raffle-id');
          if (!raffleId) return;

          // Перевіряємо, чи кнопка в процесі обробки
          if (button.classList.contains('processing')) {
            return;
          }

          // Перевіряємо, чи користувач бере участь у розіграші
          const isParticipating = participatingCache[raffleId];

          // Перевіряємо, чи розіграш недійсний
          const isInvalid =
            invalidCache[raffleId] ||
            (window.WinixRaffles &&
              window.WinixRaffles.state &&
              window.WinixRaffles.state.invalidRaffleIds &&
              window.WinixRaffles.state.invalidRaffleIds.has(raffleId));

          // Оновлюємо стан кнопки
          if (isInvalid) {
            // Для недійсних розіграшів
            button.textContent = 'Розіграш завершено';
            button.classList.add('disabled');
            button.disabled = true;
          } else if (isParticipating) {
            // Для розіграшів з участю
            const ticketCount = this.userRaffleTickets[raffleId] || 1;
            const isMini = button.classList.contains('mini-raffle-button');

            button.textContent = isMini
              ? `Додати ще білет (${ticketCount})`
              : `Додати ще білет (у вас: ${ticketCount})`;

            button.classList.add('participating');
            button.classList.remove('processing');
            button.disabled = false;

            // Зберігаємо кількість білетів у атрибуті для легкого доступу
            button.setAttribute('data-ticket-count', ticketCount);
          } else {
            // Для розіграшів без участі
            const entryFee = button.getAttribute('data-entry-fee') || '1';

            // Встановлюємо стандартний текст
            button.textContent = button.classList.contains('mini-raffle-button')
              ? 'Взяти участь'
              : `Взяти участь за ${entryFee} жетон${parseInt(entryFee) > 1 ? 'и' : ''}`;

            button.classList.remove('participating', 'processing');
            button.disabled = false;

            // Видаляємо атрибут кількості білетів
            button.removeAttribute('data-ticket-count');
          }
        });
      } catch (error) {
        console.error('❌ Помилка при оновленні кнопок участі:', error);
      }
    },

    /**
     * Участь у розіграші
     * @param {string} raffleId - ID розіграшу
     * @param {string} raffleType - Тип розіграшу (daily/main)
     * @param {number} entryCount - Кількість білетів
     * @returns {Promise<Object>} - Результат участі
     */
    participateInRaffle: async function (raffleId, raffleType, entryCount = 1) {
      console.log(`🎯 Спроба участі у розіграші ${raffleId}, кількість: ${entryCount}`);

      // Запобігаємо паралельним запитам
      if (this.requestInProgress) {
        return {
          success: false,
          message: 'Зачекайте завершення попереднього запиту',
        };
      }

      // Перевірка ID розіграшу
      if (!raffleId || !window.isValidUUID(raffleId)) {
        return {
          success: false,
          message: 'Невалідний ідентифікатор розіграшу',
        };
      }

      // Перевірка на невалідність розіграшу
      if (
        this.invalidRaffleIds.has(raffleId) ||
        (window.WinixRaffles &&
          window.WinixRaffles.state &&
          window.WinixRaffles.state.invalidRaffleIds &&
          window.WinixRaffles.state.invalidRaffleIds.has(raffleId))
      ) {
        return {
          success: false,
          message: 'Розіграш вже завершено або недоступний',
        };
      }

      // Перевірка часового інтервалу
      const now = Date.now();
      const lastRequestTime = this.lastRequestTimes[raffleId] || 0;
      if (now - lastRequestTime < this.MIN_REQUEST_INTERVAL) {
        return {
          success: false,
          message: 'Будь ласка, зачекайте перед наступною спробою',
        };
      }

      // Перевірка балансу
      const coinsBalance = this._getCurrentCoins();
      let entryFee = 1;
      try {
        const button = document.querySelector(
          `.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`
        );
        if (button) {
          entryFee = parseInt(button.getAttribute('data-entry-fee') || '1');
        }
      } catch (e) {
        console.warn('⚠️ Не вдалося отримати вартість участі:', e);
      }

      if (coinsBalance < entryFee) {
        return {
          success: false,
          message: `Недостатньо жетонів. Потрібно: ${entryFee}, у вас: ${coinsBalance}`,
        };
      }

      // Встановлюємо прапорець обробки запиту
      this.requestInProgress = true;
      this.lastParticipationTime = now;
      this.lastRequestTimes[raffleId] = now;

      // Генеруємо ID транзакції
      const transactionId = this._generateTransactionId();

      // Встановлюємо таймаут для автоматичного скидання блокування
      const timeoutId = setTimeout(() => {
        console.warn(`⚠️ Таймаут запиту для розіграшу ${raffleId}`);
        this.requestInProgress = false;
        this._resetButtonState(raffleId);
      }, this.REQUEST_TIMEOUT);

      try {
        // Показуємо індикатор завантаження
        if (typeof window.showLoading === 'function') {
          window.showLoading();
        }

        // Отримання ID користувача
        const userId = this._getUserId();
        if (!userId) {
          throw new Error('Не вдалося визначити ваш ID');
        }

        // Перевірка наявності API
        if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
          throw new Error('API недоступний. Оновіть сторінку і спробуйте знову.');
        }

        // Перевірка на участь у розіграші
        const alreadyParticipating =
          this.participatingRaffles && this.participatingRaffles.has(raffleId);

        // Формування даних запиту
        const requestData = {
          raffle_id: raffleId,
          entry_count: entryCount,
          _transaction_id: transactionId,
          _timestamp: now,
          _current_tickets: this.userRaffleTickets[raffleId] || 0,
          _already_participating: alreadyParticipating,
          _current_balance: coinsBalance,
        };

        // Відправка запиту
        const endpoint = `user/${userId}/participate-raffle`;
        console.log(`📡 Відправка запиту на участь (T:${transactionId.split('_')[1]})`);

        const response = await window.WinixAPI.apiRequest(endpoint, 'POST', requestData, {
          timeout: 15000,
          retries: 1,
          bypassThrottle: true,
        });

        // Обробка відповіді
        console.log(
          `📩 Отримано відповідь на запит участі:`,
          response.status === 'success' ? 'Успіх' : `Помилка: ${response.message}`
        );

        if (response.status === 'success') {
          // Визначаємо кількість білетів
          let newTicketCount = 1;
          if (response.data && typeof response.data.total_entries === 'number') {
            newTicketCount = response.data.total_entries;
          } else {
            const currentTickets = this.userRaffleTickets[raffleId] || 0;
            newTicketCount = currentTickets + 1;
          }

          // Оновлюємо локальні дані
          this.participatingRaffles.add(raffleId);
          this.userRaffleTickets[raffleId] = newTicketCount;

          // Оновлюємо баланс
          if (response.data && typeof response.data.new_coins_balance === 'number') {
            const oldBalance = this._getCurrentCoins();
            const newBalance = response.data.new_coins_balance;

            // Зберігаємо транзакцію
            const transactionRecord = {
              type: 'participation',
              raffleId: raffleId,
              oldBalance: oldBalance,
              newBalance: newBalance,
              timestamp: Date.now(),
              confirmed: true,
              transactionId: transactionId,
              ticketCount: newTicketCount,
            };

            localStorage.setItem('winix_last_transaction', JSON.stringify(transactionRecord));

            // Оновлюємо DOM
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
              userCoinsElement.classList.add('decreasing');
              userCoinsElement.textContent = newBalance;

              setTimeout(() => {
                userCoinsElement.classList.remove('decreasing');
              }, 1000);
            }

            // Оновлюємо локальне сховище
            localStorage.setItem('userCoins', newBalance.toString());
            localStorage.setItem('winix_coins', newBalance.toString());
            localStorage.setItem('winix_balance_update_time', Date.now().toString());

            // Запам'ятовуємо баланс
            this.lastKnownBalance = newBalance;
            this.lastBalanceUpdateTime = Date.now();

            // Генеруємо подію для інших модулів
            document.dispatchEvent(
              new CustomEvent('balance-updated', {
                detail: {
                  oldBalance: oldBalance,
                  newBalance: newBalance,
                  source: 'participation.js',
                },
              })
            );
          }

          // Оновлюємо кнопки
          const buttons = document.querySelectorAll(
            `.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`
          );
          buttons.forEach((button) => {
            button.classList.remove('processing');
            button.disabled = false;
            button.classList.add('participating');

            const isMini = button.classList.contains('mini-raffle-button');
            button.textContent = isMini
              ? `Додати ще білет (${newTicketCount})`
              : `Додати ще білет (у вас: ${newTicketCount})`;
          });

          // Зберігаємо дані
          this._saveParticipationToStorage();

          // Оновлюємо кількість учасників
          if (response.data && typeof response.data.participants_count === 'number') {
            const participantsCount = response.data.participants_count;
            const participantsElements = document.querySelectorAll(
              `.raffle-card[data-raffle-id="${raffleId}"] .participants-count .count, ` +
                `.main-raffle[data-raffle-id="${raffleId}"] .participants-info .participants-count, ` +
                `.main-raffle .participants-info .participants-count`
            );

            participantsElements.forEach((element) => {
              const currentCount = parseInt(element.textContent.replace(/\s+/g, '')) || 0;
              if (currentCount !== participantsCount) {
                element.textContent = participantsCount;
                element.classList.add('updated');
                setTimeout(() => {
                  element.classList.remove('updated');
                }, 1000);
              }
            });
          }

          // Генеруємо подію про успішну участь
          document.dispatchEvent(
            new CustomEvent('raffle-participation', {
              detail: {
                successful: true,
                raffleId: raffleId,
                ticketCount: newTicketCount,
              },
            })
          );

          // Показуємо повідомлення
          this._showToast('Ви успішно взяли участь у розіграші', 'success');

          return {
            success: true,
            data: response.data,
            message: 'Ви успішно взяли участь у розіграші',
          };
        } else {
          // Обробка помилки
          if (response.message && response.message.includes('занадто багато запитів')) {
            return {
              success: false,
              message: 'Забагато запитів. Спробуйте через 15 секунд',
            };
          } else if (
            response.message &&
            (response.message.includes('raffle_not_found') ||
              response.message.includes('завершено'))
          ) {
            // Додаємо до недійсних
            this.addInvalidRaffleId(raffleId);

            return {
              success: false,
              message: 'Розіграш не знайдено або вже завершено',
            };
          } else {
            return {
              success: false,
              message: response.message || 'Помилка участі в розіграші',
            };
          }
        }
      } catch (error) {
        console.error(`❌ Помилка участі в розіграші ${raffleId}:`, error);

        // Перевірка на завершення розіграшу
        if (
          error.message &&
          (error.message.includes('завершено') ||
            error.message.includes('not found') ||
            error.message.includes('не знайдено'))
        ) {
          this.addInvalidRaffleId(raffleId);
        }

        return {
          success: false,
          message: error.message || 'Не вдалося взяти участь у розіграші',
        };
      } finally {
        // Завершальні дії
        clearTimeout(timeoutId);
        this.requestInProgress = false;

        // Приховуємо індикатор завантаження
        if (typeof window.hideLoading === 'function') {
          window.hideLoading();
        }

        // Відкладена синхронізація
        setTimeout(() => {
          this.loadUserRaffles(true).catch((e) => {
            console.warn('⚠️ Помилка відкладеної синхронізації:', e);
          });
        }, 5000);
      }
    },

    /**
     * Додає розіграш до списку недійсних
     * @param {string} raffleId - ID розіграшу
     */
    addInvalidRaffleId: function (raffleId) {
      if (!raffleId) return;

      this.invalidRaffleIds.add(raffleId);

      // Додаємо до глобального списку
      if (
        window.WinixRaffles &&
        window.WinixRaffles.state &&
        window.WinixRaffles.state.invalidRaffleIds
      ) {
        window.WinixRaffles.state.invalidRaffleIds.add(raffleId);
      }

      // Зберігаємо в localStorage
      try {
        localStorage.setItem(
          'winix_invalid_raffles',
          JSON.stringify(Array.from(this.invalidRaffleIds))
        );
      } catch (e) {
        console.warn('⚠️ Не вдалося зберегти недійсні розіграші:', e);
      }

      console.log(`⚠️ Додано розіграш ${raffleId} до списку недійсних`);

      // Оновлюємо відображення кнопок участі
      this.updateParticipationButtons();
    },

    /**
     * Скидання стану модуля
     */
    resetState: function () {
      console.log('🔄 Виконується скидання стану модуля участі...');

      // Скидаємо прапорці
      this.requestInProgress = false;
      this.syncInProgress = false;

      // Очищення обмежень
      this.lastRequestTimes = {};

      // Оновлюємо відображення кнопок участі
      this.updateParticipationButtons();

      // Приховуємо індикатор завантаження
      if (typeof window.hideLoading === 'function') {
        window.hideLoading();
      }

      console.log('✅ Стан модуля участі успішно скинуто');
      return true;
    },
  };

  // Додаємо модуль до головного модуля розіграшів
  window.WinixRaffles.participation = participation;

  // Ініціалізація модуля при завантаженні сторінки
  document.addEventListener('DOMContentLoaded', function () {
    if (window.WinixRaffles.state.isInitialized) {
      participation.init();
    } else {
      document.addEventListener('winix-raffles-initialized', function () {
        participation.init();
      });
    }
  });

  // Додаємо анімації
  const styleElement = document.createElement('style');
  styleElement.textContent = `
        @keyframes count-updated {
            0% { transform: scale(1); color: inherit; }
            50% { transform: scale(1.2); color: #4CAF50; }
            100% { transform: scale(1); color: inherit; }
        }
        
        .participants-count.updated, .count.updated {
            animation: count-updated 1s ease-out;
        }
        
        @keyframes decrease-coins {
            0% { color: #FF5722; transform: scale(1.1); text-shadow: 0 0 5px rgba(255, 87, 34, 0.7); }
            50% { color: #FF5722; transform: scale(1.15); text-shadow: 0 0 10px rgba(255, 87, 34, 0.5); }
            100% { color: inherit; transform: scale(1); }
        }
        
        @keyframes increase-coins {
            0% { color: #4CAF50; transform: scale(1.1); text-shadow: 0 0 5px rgba(76, 175, 80, 0.7); }
            50% { color: #4CAF50; transform: scale(1.15); text-shadow: 0 0 10px rgba(76, 175, 80, 0.5); }
            100% { color: inherit; transform: scale(1); }
        }
        
        #user-coins.decreasing {
            animation: decrease-coins 0.8s ease-out;
        }
        
        #user-coins.increasing {
            animation: increase-coins 0.8s ease-out;
        }
    `;
  document.head.appendChild(styleElement);

  // Обробник помилок для автоматичного скидання стану
  window.addEventListener('error', function (event) {
    if (participation) {
      console.warn('⚠️ Глобальна помилка. Скидаємо стан участі...');
      participation.resetState();
    }
  });

  // Обробник необроблених помилок Promise
  window.addEventListener('unhandledrejection', function (event) {
    if (participation) {
      console.warn('⚠️ Необроблена Promise помилка. Скидаємо стан участі...');
      participation.resetState();
    }
  });

  console.log('✅ Модуль participation.js успішно завантажено');
})();
