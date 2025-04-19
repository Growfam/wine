/**
 * WINIX - Система розіграшів (ticket-manager.js)
 * Покращений модуль для коректного управління білетами та жетонами
 * Виправлені проблеми з дублюванням участі
 * @version 1.1.0
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше ticket-manager.js');
        return;
    }

    // Модуль управління білетами
    const ticketManager = {
        // Дані про кількість білетів для кожного розіграшу
        ticketCounts: {},

        // Дані про вартість участі для кожного розіграшу
        entryFees: {},

        // Поточна кількість жетонів користувача
        currentCoins: 0,

        // Лічильник транзакцій для відстеження
        transactionCounter: 0,

        // Чи відбувається транзакція зараз
        isTransactionInProgress: false,

        // Час останньої транзакції
        lastTransactionTime: 0,

        // Мінімальний інтервал між транзакціями (мс)
        minTransactionInterval: 1500, // Збільшено з 600 до 1500

        // Історія транзакцій
        transactionHistory: [],

        // Максимальний розмір історії транзакцій
        maxHistorySize: 50,

        // НОВЕ: Таймер для відкладеної синхронізації
        syncTimer: null,

        // НОВЕ: Стан таймера зворотного відліку
        cooldownTimers: {},

        /**
         * Ініціалізація модуля
         */
        init: function() {
            console.log('🎟️ Ініціалізація модуля управління білетами...');

            // НОВЕ: Очищення стану перед ініціалізацією
            this._cleanupState();

            // Оновлюємо доступну кількість жетонів
            this.updateCurrentCoins();

            // Завантажуємо кількість білетів користувача
            this.loadUserTickets();

            // Додаємо обробники подій
            this.setupEventHandlers();

            // НОВЕ: Силове оновлення даних після затримки
            setTimeout(() => {
                this.loadUserTickets(true);
            }, 2000);
        },

        /**
         * НОВЕ: Очищення стану перед ініціалізацією
         * @private
         */
        _cleanupState: function() {
            // Скидання стану транзакції
            this.isTransactionInProgress = false;

            // Очищення таймеру зворотного відліку
            for (const timerId in this.cooldownTimers) {
                if (this.cooldownTimers.hasOwnProperty(timerId)) {
                    clearTimeout(this.cooldownTimers[timerId]);
                }
            }
            this.cooldownTimers = {};

            // Очищення таймеру синхронізації
            if (this.syncTimer) {
                clearTimeout(this.syncTimer);
                this.syncTimer = null;
            }
        },

        /**
         * Налаштування обробників подій
         */
        setupEventHandlers: function() {
            // Обробник події успішної участі в розіграші
            document.addEventListener('raffle-participation', (event) => {
                if (event.detail && event.detail.successful) {
                    this.handleSuccessfulParticipation(event.detail);
                }
            });

            // Обробник події оновлення балансу користувача
            document.addEventListener('user-data-updated', (event) => {
                if (event.detail && event.detail.userData) {
                    this.updateCurrentCoins(event.detail.userData.coins);

                    // НОВЕ: Оновлюємо дані про білети
                    if (!event.detail.source || event.detail.source !== 'ticket-manager') {
                        setTimeout(() => {
                            this.loadUserTickets(true);
                        }, 1000);
                    }
                }
            });

            // Обробник натискання на кнопки участі
            document.addEventListener('click', (event) => {
                const participateButton = event.target.closest('.join-button, .mini-raffle-button');
                if (!participateButton) return;

                // Перевіряємо чи не заблокована кнопка
                if (participateButton.disabled || participateButton.classList.contains('processing')) {
                    event.preventDefault();
                    event.stopPropagation();
                    console.log('👆 Кліки по заблокованій кнопці заборонено');
                    return;
                }

                // Перевіряємо чи це кнопка для вже існуючої участі
                if (participateButton.classList.contains('participating')) {
                    const raffleId = participateButton.getAttribute('data-raffle-id');
                    if (raffleId) {
                        // НОВЕ: Перевірка на таймер зворотного відліку
                        if (this.cooldownTimers[raffleId]) {
                            event.preventDefault();
                            event.stopPropagation();

                            if (typeof window.showToast === 'function') {
                                window.showToast('Будь ласка, зачекайте перед наступною спробою', 'info');
                            }
                            return;
                        }

                        // Запам'ятовуємо вартість участі
                        const entryFee = parseInt(participateButton.getAttribute('data-entry-fee')) || 1;
                        this.entryFees[raffleId] = entryFee;

                        // Перевіряємо наявність достатньої кількості жетонів
                        if (!this.hasEnoughCoins(entryFee)) {
                            event.preventDefault();
                            event.stopPropagation();

                            this.showNotEnoughCoinsMessage(entryFee);
                            return false;
                        }

                        // НОВЕ: Створюємо таймер зворотного відліку для цього розіграшу
                        this.cooldownTimers[raffleId] = setTimeout(() => {
                            delete this.cooldownTimers[raffleId];
                        }, this.minTransactionInterval);
                    }
                }
            });

            // Обробник завантаження розіграшів
            document.addEventListener('raffles-loaded', () => {
                this.extractEntryFeesFromDOM();

                // НОВЕ: Оновлюємо дані про білети
                setTimeout(() => {
                    this.loadUserTickets();
                }, 1000);
            });
        },

        /**
         * Витягування вартості участі з DOM
         */
        extractEntryFeesFromDOM: function() {
            // Перебираємо всі кнопки участі
            const buttons = document.querySelectorAll('.join-button, .mini-raffle-button');
            buttons.forEach(button => {
                const raffleId = button.getAttribute('data-raffle-id');
                if (!raffleId) return;

                // Витягуємо вартість участі
                let entryFee = 1;

                // Спробуємо витягти з атрибуту
                if (button.hasAttribute('data-entry-fee')) {
                    entryFee = parseInt(button.getAttribute('data-entry-fee')) || 1;
                } else {
                    // Спробуємо витягти з тексту
                    const buttonText = button.textContent;
                    const matches = buttonText.match(/за\s+(\d+)\s+жетон/i);
                    if (matches && matches[1]) {
                        entryFee = parseInt(matches[1]) || 1;
                    }
                }

                // Зберігаємо вартість участі
                this.entryFees[raffleId] = entryFee;

                // Додаємо атрибут, якщо його немає
                if (!button.hasAttribute('data-entry-fee')) {
                    button.setAttribute('data-entry-fee', entryFee);
                }
            });
        },

        /**
         * Оновлення поточної кількості жетонів
         * @param {number} coins - Кількість жетонів
         */
        updateCurrentCoins: function(coins) {
            // Якщо передано значення, використовуємо його
            if (coins !== undefined) {
                this.currentCoins = coins;
                return;
            }

            // Спробуємо отримати з елемента DOM
            const coinsElement = document.getElementById('user-coins');
            if (coinsElement) {
                this.currentCoins = parseInt(coinsElement.textContent) || 0;
                return;
            }

            // Спробуємо отримати з localStorage
            this.currentCoins = parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins')) || 0;
        },

        /**
         * Завантаження кількості білетів користувача
         * @param {boolean} forceRefresh - Примусове оновлення
         */
        loadUserTickets: function(forceRefresh = false) {
            // НОВЕ: Перевірка необхідності оновлення
            if (!forceRefresh && Object.keys(this.ticketCounts).length > 0) {
                console.log('🎟️ Використовуємо кешовані дані про білети');
                return;
            }

            console.log('🎟️ Оновлення даних про білети');

            // Скидаємо попередній стан
            const previousTickets = {...this.ticketCounts};
            this.ticketCounts = {};

            // Спробуємо отримати дані з WinixRaffles
            if (window.WinixRaffles && window.WinixRaffles.participation) {
                const participation = window.WinixRaffles.participation;

                // Якщо є список розіграшів з участю
                if (participation.participatingRaffles) {
                    participation.participatingRaffles.forEach(raffleId => {
                        // Отримуємо кількість білетів
                        const ticketCount = participation.userRaffleTickets &&
                                          participation.userRaffleTickets[raffleId] || 1;

                        // Зберігаємо кількість білетів
                        this.ticketCounts[raffleId] = ticketCount;
                    });
                }

                // Якщо є дані про кількість білетів
                if (participation.userRaffleTickets) {
                    Object.keys(participation.userRaffleTickets).forEach(raffleId => {
                        this.ticketCounts[raffleId] = participation.userRaffleTickets[raffleId];
                    });
                }
            }

            // Спробуємо отримати дані з localStorage
            try {
                const savedTickets = localStorage.getItem('winix_user_tickets');
                if (savedTickets) {
                    const parsedTickets = JSON.parse(savedTickets);

                    // Об'єднуємо з поточними даними
                    this.ticketCounts = {...this.ticketCounts, ...parsedTickets};
                }
            } catch (e) {
                console.warn('⚠️ Помилка завантаження даних про білети:', e);
            }

            // Перевіряємо зміни і виводимо логи
            let hasChanges = false;
            for (const raffleId in this.ticketCounts) {
                if (previousTickets[raffleId] !== this.ticketCounts[raffleId]) {
                    hasChanges = true;
                    break;
                }
            }

            if (hasChanges || forceRefresh) {
                console.log('🎟️ Оновлені дані про білети:', this.ticketCounts);
                this.saveTicketsToStorage();
                this.updateTicketDisplayForAll();
            }
        },

        /**
         * НОВЕ: Оновлення відображення білетів для всіх розіграшів
         */
        updateTicketDisplayForAll: function() {
            for (const raffleId in this.ticketCounts) {
                this.updateTicketDisplay(raffleId, this.ticketCounts[raffleId]);
            }
        },

        /**
         * Перевірка наявності достатньої кількості жетонів
         * @param {number} requiredCoins - Необхідна кількість жетонів
         * @returns {boolean} Результат перевірки
         */
        hasEnoughCoins: function(requiredCoins) {
            return this.currentCoins >= requiredCoins;
        },

        /**
         * Показ повідомлення про недостатню кількість жетонів
         * @param {number} requiredCoins - Необхідна кількість жетонів
         */
        showNotEnoughCoinsMessage: function(requiredCoins) {
            // Показуємо повідомлення про недостатню кількість жетонів
            if (typeof window.showToast === 'function') {
                window.showToast(`Недостатньо жетонів для участі. Потрібно ${requiredCoins}, у вас ${this.currentCoins}.`, 'warning');
            } else {
                alert(`Недостатньо жетонів для участі. Потрібно ${requiredCoins}, у вас ${this.currentCoins}.`);
            }
        },

        /**
         * Обробка успішної участі в розіграші
         * @param {Object} data - Дані про участь
         */
        handleSuccessfulParticipation: function(data) {
            if (!data || !data.raffleId) return;

            // Оновлюємо кількість білетів
            const raffleId = data.raffleId;
            const ticketCount = data.ticketCount || (this.ticketCounts[raffleId] || 0) + 1;

            // НОВЕ: Запам'ятовуємо попередню кількість для відстеження змін
            const previousTicketCount = this.ticketCounts[raffleId] || 0;

            // Зберігаємо оновлену кількість білетів
            this.ticketCounts[raffleId] = ticketCount;

            // Зберігаємо в localStorage
            this.saveTicketsToStorage();

            // Оновлюємо відображення білетів
            this.updateTicketDisplay(raffleId, ticketCount);

            // Зменшуємо кількість жетонів
            this.decreaseCoins(raffleId);

            // Додаємо транзакцію в історію
            this.addTransaction({
                type: 'participation',
                raffleId: raffleId,
                ticketCount: ticketCount,
                previousTicketCount: previousTicketCount,
                fee: this.entryFees[raffleId] || 1,
                timestamp: Date.now()
            });

            // НОВЕ: Плануємо додаткову синхронізацію через 3 секунди
            if (this.syncTimer) {
                clearTimeout(this.syncTimer);
            }

            this.syncTimer = setTimeout(() => {
                console.log('🔄 Виконуємо відкладену перевірку стану білетів');
                this.loadUserTickets(true);
            }, 3000);
        },

        /**
         * Зменшення кількості жетонів після участі
         * @param {string} raffleId - ID розіграшу
         */
        decreaseCoins: function(raffleId) {
            // Отримуємо вартість участі
            const entryFee = this.entryFees[raffleId] || 1;

            // Оновлюємо кількість жетонів
            this.currentCoins = Math.max(0, this.currentCoins - entryFee);

            // Оновлюємо відображення жетонів
            const coinsElement = document.getElementById('user-coins');
            if (coinsElement) {
                coinsElement.textContent = this.currentCoins;

                // Додаємо анімацію зміни
                coinsElement.classList.add('decreasing');
                setTimeout(() => {
                    coinsElement.classList.remove('decreasing');
                }, 1000);
            }

            // Оновлюємо localStorage
            localStorage.setItem('userCoins', this.currentCoins.toString());
            localStorage.setItem('winix_coins', this.currentCoins.toString());

            // НОВЕ: Відправляємо подію про оновлення балансу
            document.dispatchEvent(new CustomEvent('user-data-updated', {
                detail: {
                    userData: {
                        coins: this.currentCoins,
                        update_source: 'participation'
                    },
                    source: 'ticket-manager'
                }
            }));
        },

        /**
         * Оновлення відображення кількості білетів
         * @param {string} raffleId - ID розіграшу
         * @param {number} ticketCount - Кількість білетів
         */
        updateTicketDisplay: function(raffleId, ticketCount) {
            // Знаходимо кнопки участі для цього розіграшу
            const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);

            buttons.forEach(button => {
                // Переконуємося, що кнопка має правильний стан
                button.classList.add('participating');
                button.disabled = false;

                // Оновлюємо текст кнопки
                const isMini = button.classList.contains('mini-raffle-button');
                button.textContent = isMini ?
                    `Додати ще білет (${ticketCount})` :
                    `Додати ще білет (у вас: ${ticketCount})`;
            });

            // Оновлюємо в модулі participation, якщо він доступний
            if (window.WinixRaffles && window.WinixRaffles.participation) {
                // Додаємо розіграш до множини з участю
                if (window.WinixRaffles.participation.participatingRaffles) {
                    window.WinixRaffles.participation.participatingRaffles.add(raffleId);
                }

                // Оновлюємо кількість білетів
                if (window.WinixRaffles.participation.userRaffleTickets) {
                    window.WinixRaffles.participation.userRaffleTickets[raffleId] = ticketCount;
                }

                // НОВЕ: Зберігаємо стан участі
                if (typeof window.WinixRaffles.participation._saveParticipationToStorage === 'function') {
                    window.WinixRaffles.participation._saveParticipationToStorage();
                }
            }
        },

        /**
         * Збереження даних про білети в localStorage
         */
        saveTicketsToStorage: function() {
            try {
                localStorage.setItem('winix_user_tickets', JSON.stringify(this.ticketCounts));
            } catch (e) {
                console.warn('⚠️ Помилка збереження даних про білети:', e);
            }
        },

        /**
         * Участь у розіграші
         * @param {string} raffleId - ID розіграшу
         * @param {number} entryCount - Кількість білетів для додавання
         * @returns {Promise<Object>} Результат участі
         */
        participateInRaffle: async function(raffleId, entryCount = 1) {
            // Валідація параметрів
            if (!raffleId) {
                return {
                    success: false,
                    message: 'Не вказано ID розіграшу'
                };
            }

            // Перевірка на мінімальний інтервал між транзакціями
            const now = Date.now();
            if (now - this.lastTransactionTime < this.minTransactionInterval) {
                return {
                    success: false,
                    message: 'Занадто багато запитів. Зачекайте секунду.'
                };
            }

            // Перевірка на активну транзакцію
            if (this.isTransactionInProgress) {
                return {
                    success: false,
                    message: 'Зачекайте завершення попередньої транзакції'
                };
            }

            // НОВЕ: Перевірка на таймер зворотного відліку
            if (this.cooldownTimers[raffleId]) {
                return {
                    success: false,
                    message: 'Потрібно зачекати перед наступною спробою'
                };
            }

            // Отримуємо вартість участі
            const entryFee = this.entryFees[raffleId] || 1;

            // Перевіряємо наявність достатньої кількості жетонів
            if (!this.hasEnoughCoins(entryFee * entryCount)) {
                this.showNotEnoughCoinsMessage(entryFee * entryCount);
                return {
                    success: false,
                    message: 'Недостатньо жетонів для участі'
                };
            }

            // Встановлюємо флаг активної транзакції
            this.isTransactionInProgress = true;
            this.lastTransactionTime = now;

            // НОВЕ: Створюємо таймер зворотного відліку для цього розіграшу
            this.cooldownTimers[raffleId] = setTimeout(() => {
                delete this.cooldownTimers[raffleId];
            }, this.minTransactionInterval);

            try {
                // Показуємо індикатор завантаження
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }

                // Генеруємо унікальний ID транзакції
                const transactionId = `${raffleId}_${now}_${this.transactionCounter++}`;

                // НОВЕ: Запам'ятовуємо поточну кількість білетів
                const currentTicketCount = this.ticketCounts[raffleId] || 0;

                // Запит до API через основний модуль participation
                if (window.WinixRaffles &&
                    window.WinixRaffles.participation &&
                    typeof window.WinixRaffles.participation.participateInRaffle === 'function') {

                    const result = await window.WinixRaffles.participation.participateInRaffle(raffleId, entryCount);

                    // Обробка результату
                    if (result.success) {
                        // Оновлюємо кількість білетів
                        // НОВЕ: Використовуємо дані із сервера, якщо вони є
                        let newTicketCount;
                        if (result.data && result.data.total_entries) {
                            newTicketCount = result.data.total_entries;
                        } else {
                            newTicketCount = currentTicketCount + entryCount;
                        }

                        this.ticketCounts[raffleId] = newTicketCount;

                        // Зменшуємо кількість жетонів
                        this.updateCurrentCoins(this.currentCoins - (entryFee * entryCount));

                        // Зберігаємо в localStorage
                        this.saveTicketsToStorage();

                        // Генеруємо подію про успішну участь
                        this.triggerParticipationEvent(raffleId, newTicketCount);

                        // НОВЕ: Запланувати перевірку через 3 секунди
                        setTimeout(() => {
                            this.loadUserTickets(true);
                        }, 3000);
                    }

                    return result;
                } else {
                    // Запасний варіант, якщо модуль participation недоступний
                    try {
                        // Отримуємо ID користувача
                        const userId = this.getUserId();
                        if (!userId) {
                            throw new Error('Не вдалося визначити ID користувача');
                        }

                        // Формуємо запит до API
                        let response;

                        if (typeof window.WinixAPI !== 'undefined' &&
                            typeof window.WinixAPI.apiRequest === 'function') {

                            response = await window.WinixAPI.apiRequest(`user/${userId}/participate-raffle`, 'POST', {
                                raffle_id: raffleId,
                                entry_count: entryCount,
                                _transaction_id: transactionId,
                                // НОВЕ: Додаємо інформацію про поточну кількість білетів
                                _current_tickets: currentTicketCount
                            });
                        } else {
                            // Прямий запит через fetch
                            const fetchResponse = await fetch(`/api/user/${userId}/participate-raffle`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    raffle_id: raffleId,
                                    entry_count: entryCount,
                                    _transaction_id: transactionId,
                                    _current_tickets: currentTicketCount
                                })
                            });

                            response = await fetchResponse.json();
                        }

                        // Обробка результату
                        if (response && response.status === 'success') {
                            // Оновлюємо кількість білетів
                            // НОВЕ: Використовуємо дані із сервера, якщо вони є
                            let newTicketCount;
                            if (response.data && response.data.total_entries) {
                                newTicketCount = response.data.total_entries;
                            } else {
                                newTicketCount = currentTicketCount + entryCount;
                            }

                            this.ticketCounts[raffleId] = newTicketCount;

                            // Зменшуємо кількість жетонів
                            this.updateCurrentCoins(this.currentCoins - (entryFee * entryCount));

                            // Зберігаємо в localStorage
                            this.saveTicketsToStorage();

                            // Генеруємо подію про успішну участь
                            this.triggerParticipationEvent(raffleId, newTicketCount);

                            // НОВЕ: Запланувати перевірку через 3 секунди
                            setTimeout(() => {
                                this.loadUserTickets(true);
                            }, 3000);

                            return {
                                success: true,
                                data: response.data,
                                message: 'Успішна участь у розіграші'
                            };
                        } else {
                            throw new Error(response.message || 'Помилка участі в розіграші');
                        }
                    } catch (error) {
                        return {
                            success: false,
                            message: error.message || 'Помилка участі в розіграші'
                        };
                    }
                }
            } catch (error) {
                console.error('❌ Помилка участі в розіграші:', error);

                return {
                    success: false,
                    message: error.message || 'Помилка участі в розіграші'
                };
            } finally {
                // Скидаємо флаг активної транзакції
                this.isTransactionInProgress = false;

                // Приховуємо індикатор завантаження
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }
            }
        },

        /**
         * Генерація події про успішну участь у розіграші
         * @param {string} raffleId - ID розіграшу
         * @param {number} ticketCount - Кількість білетів
         */
        triggerParticipationEvent: function(raffleId, ticketCount) {
            document.dispatchEvent(new CustomEvent('raffle-participation', {
                detail: {
                    successful: true,
                    raffleId: raffleId,
                    ticketCount: ticketCount
                }
            }));
        },

        /**
         * Отримання ID користувача
         * @returns {string|null} ID користувача
         */
        getUserId: function() {
            // Спробуємо отримати з WinixRaffles
            if (window.WinixRaffles && window.WinixRaffles.state && window.WinixRaffles.state.telegramId) {
                return window.WinixRaffles.state.telegramId;
            }

            // Спробуємо отримати з WinixAPI
            if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
                return window.WinixAPI.getUserId();
            }

            // Спробуємо отримати з елемента DOM
            const userIdElement = document.getElementById('user-id') || document.getElementById('header-user-id');
            if (userIdElement) {
                return userIdElement.textContent;
            }

            // Спробуємо отримати з localStorage
            return localStorage.getItem('telegram_user_id');
        },

        /**
         * Додавання транзакції в історію
         * @param {Object} transaction - Дані про транзакцію
         */
        addTransaction: function(transaction) {
            // Додаємо транзакцію в початок масиву
            this.transactionHistory.unshift(transaction);

            // Обмежуємо розмір історії
            if (this.transactionHistory.length > this.maxHistorySize) {
                this.transactionHistory = this.transactionHistory.slice(0, this.maxHistorySize);
            }

            // Зберігаємо історію в localStorage
            try {
                localStorage.setItem('winix_transaction_history', JSON.stringify(this.transactionHistory));
            } catch (e) {
                console.warn('⚠️ Помилка збереження історії транзакцій:', e);
            }
        },

        /**
         * Отримання кількості білетів для розіграшу
         * @param {string} raffleId - ID розіграшу
         * @returns {number} Кількість білетів
         */
        getTicketCount: function(raffleId) {
            return this.ticketCounts[raffleId] || 0;
        },

        /**
         * Отримання вартості участі для розіграшу
         * @param {string} raffleId - ID розіграшу
         * @returns {number} Вартість участі
         */
        getEntryFee: function(raffleId) {
            return this.entryFees[raffleId] || 1;
        },

        /**
         * Оновлення вартості участі для розіграшу
         * @param {string} raffleId - ID розіграшу
         * @param {number} fee - Вартість участі
         */
        updateEntryFee: function(raffleId, fee) {
            if (!raffleId) return;

            // Зберігаємо вартість участі
            this.entryFees[raffleId] = fee;

            // Оновлюємо атрибути кнопок
            const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
            buttons.forEach(button => {
                button.setAttribute('data-entry-fee', fee);

                // Якщо кнопка не в стані участі, оновлюємо текст
                if (!button.classList.contains('participating')) {
                    if (button.classList.contains('mini-raffle-button')) {
                        button.textContent = `Взяти участь (${fee} жетон${fee > 1 ? 'и' : ''})`;
                    } else {
                        button.textContent = `Взяти участь за ${fee} жетон${fee > 1 ? 'и' : ''}`;
                    }
                }
            });
        },

        /**
         * Синхронізація з сервером
         * @returns {Promise<boolean>} Результат синхронізації
         */
        syncWithServer: async function() {
            // НОВЕ: Перевірка на активну транзакцію
            if (this.isTransactionInProgress) {
                console.log('⚠️ Не можна синхронізувати під час активної транзакції');
                return false;
            }

            console.log('🔄 Запуск синхронізації з сервером...');

            // Завантажуємо актуальні дані про участь користувача
            if (window.WinixRaffles &&
                window.WinixRaffles.participation &&
                typeof window.WinixRaffles.participation.loadUserRaffles === 'function') {

                try {
                    // НОВЕ: Встановлюємо флаг транзакції для запобігання конфліктам
                    this.isTransactionInProgress = true;

                    await window.WinixRaffles.participation.loadUserRaffles(true);

                    // Оновлюємо локальні дані
                    this.loadUserTickets(true);

                    // Оновлюємо відображення
                    Object.keys(this.ticketCounts).forEach(raffleId => {
                        this.updateTicketDisplay(raffleId, this.ticketCounts[raffleId]);
                    });

                    // Оновлюємо поточну кількість жетонів
                    this.updateCurrentCoins();

                    console.log('✅ Синхронізація з сервером успішна');
                    return true;
                } catch (error) {
                    console.error('❌ Помилка синхронізації з сервером:', error);
                    return false;
                } finally {
                    // Скидаємо флаг транзакції
                    this.isTransactionInProgress = false;
                }
            }

            return false;
        },

        /**
         * Скидання стану кнопок участі
         */
        resetParticipationButtons: function() {
            // Знаходимо всі кнопки участі
            const buttons = document.querySelectorAll('.join-button, .mini-raffle-button');

            buttons.forEach(button => {
                const raffleId = button.getAttribute('data-raffle-id');
                if (!raffleId) return;

                // Перевіряємо, чи користувач бере участь у розіграші
                if (this.ticketCounts[raffleId]) {
                    // Оновлюємо вигляд кнопки
                    button.classList.add('participating');
                    button.disabled = false;

                    // Оновлюємо текст кнопки
                    const isMini = button.classList.contains('mini-raffle-button');
                    button.textContent = isMini ?
                        `Додати ще білет (${this.ticketCounts[raffleId]})` :
                        `Додати ще білет (у вас: ${this.ticketCounts[raffleId]})`;
                } else {
                    // Скидаємо стан кнопки
                    button.classList.remove('participating');
                    button.disabled = false;

                    // Оновлюємо текст кнопки
                    const entryFee = this.entryFees[raffleId] || 1;

                    if (button.classList.contains('mini-raffle-button')) {
                        button.textContent = `Взяти участь`;
                    } else {
                        button.textContent = `Взяти участь за ${entryFee} жетон${entryFee > 1 ? 'и' : ''}`;
                    }
                }
            });
        },

        /**
         * Перевірка стану транзакцій
         * Виявляє зависаючі транзакції та скидає їх
         */
        checkTransactionState: function() {
            // Перевіряємо, чи є активна транзакція
            if (!this.isTransactionInProgress) return;

            // Перевіряємо час останньої транзакції
            const now = Date.now();
            const timeSinceLastTransaction = now - this.lastTransactionTime;

            // Якщо транзакція триває більше 10 секунд, скидаємо її
            if (timeSinceLastTransaction > 10000) {
                console.warn('⚠️ Виявлено зависаючу транзакцію, скидаємо стан');

                // Скидаємо стан транзакції
                this.isTransactionInProgress = false;

                // Приховуємо індикатор завантаження
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                // Синхронізуємо з сервером
                this.syncWithServer();
            }
        }
    };

    // Додаємо модуль до головного модуля розіграшів
    window.WinixRaffles.ticketManager = ticketManager;

    // Додаємо стилі для модуля
    const addTicketManagerStyles = function() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('ticket-manager-styles')) return;

        const style = document.createElement('style');
        style.id = 'ticket-manager-styles';
        style.textContent = `
            /* Анімація зміни кількості жетонів */
            @keyframes decrease-coins {
                0% { color: #FF5722; transform: scale(1.1); }
                100% { color: inherit; transform: scale(1); }
            }
            
            #user-coins.decreasing {
                animation: decrease-coins 0.5s ease-out;
            }
            
            /* НОВЕ: Анімація мерехтіння для кнопок під час таймауту */
            @keyframes button-cooldown {
                0% { opacity: 0.8; }
                50% { opacity: 0.6; }
                100% { opacity: 0.8; }
            }
            
            /* НОВЕ: Стилі для кнопок у стані очікування */
            .join-button.cooling-down,
            .mini-raffle-button.cooling-down {
                animation: button-cooldown 1s ease-in-out infinite;
                background: linear-gradient(90deg, #9e9e9e, #616161) !important;
                pointer-events: none;
            }
        `;

        document.head.appendChild(style);
    };

    // Ініціалізація модуля
    document.addEventListener('DOMContentLoaded', function() {
        // Додаємо стилі
        addTicketManagerStyles();

        if (window.WinixRaffles.state.isInitialized) {
            ticketManager.init();

            // Запускаємо періодичну перевірку стану транзакцій
            setInterval(() => {
                ticketManager.checkTransactionState();
            }, 5000);
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                ticketManager.init();

                // Запускаємо періодичну перевірку стану транзакцій
                setInterval(() => {
                    ticketManager.checkTransactionState();
                }, 5000);
            });
        }
    });

    // НОВЕ: Додаємо обробник для глобальних помилок
    window.addEventListener('error', function(event) {
        // Скидаємо стан транзакції при глобальних помилках
        if (ticketManager && ticketManager.isTransactionInProgress) {
            console.warn('⚠️ Виявлено глобальну помилку під час транзакції. Скидаємо стан.');
            ticketManager.isTransactionInProgress = false;

            // Очищення таймерів
            for (const timerId in ticketManager.cooldownTimers) {
                if (ticketManager.cooldownTimers.hasOwnProperty(timerId)) {
                    clearTimeout(ticketManager.cooldownTimers[timerId]);
                }
            }
            ticketManager.cooldownTimers = {};

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }
        }
    });

    console.log('✅ Модуль управління білетами успішно завантажено');
})();