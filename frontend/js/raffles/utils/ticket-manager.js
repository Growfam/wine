/**
 * WINIX - Система розіграшів (ticket-manager.js)
 * Повністю виправлений модуль для коректного управління білетами та жетонами
 * Усунено проблеми зі списанням жетонів та дублюванням участі
 * @version 1.3.0
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

        // Поточна кількість жетонів користувача (оновлюється ТІЛЬКИ з сервера)
        currentCoins: 0,

        // Лічильник транзакцій для відстеження
        transactionCounter: 0,

        // Чи відбувається транзакція зараз
        isTransactionInProgress: false,

        // Час останньої транзакції
        lastTransactionTime: 0,

        // Мінімальний інтервал між транзакціями (мс)
        minTransactionInterval: 2000, // 2 секунди між запитами

        // Історія транзакцій
        transactionHistory: [],

        // Максимальний розмір історії транзакцій
        maxHistorySize: 50,

        // Таймер для відкладеної синхронізації
        syncTimer: null,

        // Стан таймера зворотного відліку
        cooldownTimers: {},

        // Запам'ятовуємо останню відповідь балансу від сервера
        lastServerBalance: null,
        lastBalanceUpdateTime: 0,

        /**
         * Ініціалізація модуля
         */
        init: function() {
            console.log('🎟️ Ініціалізація модуля управління білетами...');

            // Очищення стану перед ініціалізацією
            this._cleanupState();

            // Оновлюємо доступну кількість жетонів
            this.updateCurrentCoins();

            // Завантажуємо кількість білетів користувача
            this.loadUserTickets();

            // Додаємо обробники подій
            this.setupEventHandlers();

            // Силове оновлення даних після затримки
            setTimeout(() => {
                this.loadUserTickets(true);
            }, 2000);

            // Додаємо регулярну синхронізацію балансу
            setInterval(() => {
                this.syncServerBalance();
            }, 60000); // Кожну хвилину
        },

        /**
         * Очищення стану перед ініціалізацією
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

            // Очищення стану блокування кнопок
            document.querySelectorAll('.join-button.processing, .mini-raffle-button.processing').forEach(button => {
                button.classList.remove('processing');
                button.disabled = false;
            });
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

            // Покращений обробник події оновлення балансу користувача
            document.addEventListener('user-data-updated', (event) => {
                if (event.detail && event.detail.userData) {
                    // Оновлюємо тільки якщо прийшов новий баланс і він відрізняється від поточного
                    if (typeof event.detail.userData.coins === 'number') {
                        const newCoins = event.detail.userData.coins;
                        const source = event.detail.source || 'unknown';

                        console.log(`📊 Отримано оновлення балансу: ${newCoins} жетонів (джерело: ${source})`);

                        // Оновлюємо баланс лише якщо це не наше джерело або це актуальніші дані з сервера
                        if (source !== 'ticket-manager' ||
                            (event.detail.userData.server_synchronized &&
                             event.detail.userData.timestamp > this.lastBalanceUpdateTime)) {

                            this.updateCurrentCoins(newCoins);

                            // Запам'ятовуємо час оновлення, якщо це дані з сервера
                            if (event.detail.userData.server_synchronized) {
                                this.lastServerBalance = newCoins;
                                this.lastBalanceUpdateTime = event.detail.userData.timestamp || Date.now();
                            }
                        }
                    }

                    // Оновлюємо дані про білети тільки якщо це не наша подія
                    if (event.detail.source !== 'ticket-manager') {
                        setTimeout(() => {
                            this.loadUserTickets(true);
                        }, 1000);
                    }
                }
            });

            // Покращений обробник натискання на кнопки участі
            document.addEventListener('click', (event) => {
                const participateButton = event.target.closest('.join-button, .mini-raffle-button');
                if (!participateButton) return;

                // Перевіряємо чи не заблокована кнопка
                if (participateButton.disabled || participateButton.classList.contains('processing')) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }

                const raffleId = participateButton.getAttribute('data-raffle-id');
                if (!raffleId) return;

                // Перевірка на таймер зворотного відліку
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
                    return;
                }

                // Додаємо клас та відключаємо кнопку перед запитом
                participateButton.classList.add('processing');
                participateButton.disabled = true;

                // Зберігаємо оригінальний текст кнопки
                if (!participateButton.getAttribute('data-original-text')) {
                    participateButton.setAttribute('data-original-text', participateButton.textContent);
                }
                participateButton.textContent = 'Обробка...';

                // Створюємо таймер зворотного відліку для цього розіграшу
                this.cooldownTimers[raffleId] = setTimeout(() => {
                    delete this.cooldownTimers[raffleId];
                }, this.minTransactionInterval);
            });

            // Обробник завантаження розіграшів
            document.addEventListener('raffles-loaded', () => {
                this.extractEntryFeesFromDOM();

                // Оновлюємо дані про білети
                setTimeout(() => {
                    this.loadUserTickets();
                }, 1000);
            });
        },

        /**
         * Синхронізація балансу з сервером
         */
        syncServerBalance: async function() {
            try {
                // Пропускаємо, якщо транзакція в процесі
                if (this.isTransactionInProgress) return;

                console.log("🔄 Синхронізація балансу з сервером...");

                // Отримуємо актуальний баланс через API
                if (window.WinixAPI && typeof window.WinixAPI.getBalance === 'function') {
                    const response = await window.WinixAPI.getBalance();

                    if (response && response.status === 'success' && response.data) {
                        // Зберігаємо баланс з сервера як еталонний
                        this.lastServerBalance = response.data.coins;
                        this.lastBalanceUpdateTime = Date.now();

                        console.log(`✅ Синхронізовано баланс: ${response.data.coins} жетонів`);

                        // Порівнюємо з поточним значенням
                        if (this.currentCoins !== response.data.coins) {
                            console.log(`📊 Виявлено розбіжність балансу: локально ${this.currentCoins}, на сервері ${response.data.coins}`);

                            // Оновлюємо баланс
                            this.updateCurrentCoins(response.data.coins);

                            // Сповіщаємо систему про оновлення з сервера
                            document.dispatchEvent(new CustomEvent('user-data-updated', {
                                detail: {
                                    userData: {
                                        coins: response.data.coins,
                                        server_synchronized: true,
                                        timestamp: Date.now()
                                    },
                                    source: 'ticket-manager'
                                }
                            }));
                        }
                    }
                }
            } catch (error) {
                console.warn("⚠️ Помилка синхронізації балансу:", error);
            }
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
            const oldCoins = this.currentCoins;

            // Якщо передано значення, використовуємо його
            if (coins !== undefined) {
                this.currentCoins = coins;
            } else {
                // Спробуємо отримати з елемента DOM
                const coinsElement = document.getElementById('user-coins');
                if (coinsElement) {
                    this.currentCoins = parseInt(coinsElement.textContent) || 0;
                } else {
                    // Спробуємо отримати з localStorage
                    this.currentCoins = parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins')) || 0;
                }
            }

            // Оновлюємо відображення, якщо значення змінилося
            if (oldCoins !== this.currentCoins) {
                this.updateCoinsDisplay();
            }
        },

        /**
         * Оновлення відображення жетонів
         */
        updateCoinsDisplay: function() {
            // Оновлюємо елемент в DOM
            const coinsElement = document.getElementById('user-coins');
            if (coinsElement && coinsElement.textContent !== this.currentCoins.toString()) {
                coinsElement.textContent = this.currentCoins;
            }

            // Оновлюємо localStorage
            localStorage.setItem('userCoins', this.currentCoins.toString());
            localStorage.setItem('winix_coins', this.currentCoins.toString());
        },

        /**
         * Завантаження кількості білетів користувача
         * @param {boolean} forceRefresh - Примусове оновлення
         */
        loadUserTickets: function(forceRefresh = false) {
            // Перевірка необхідності оновлення
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
         * Оновлення відображення білетів для всіх розіграшів
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

            // Запам'ятовуємо попередню кількість для відстеження змін
            const previousTicketCount = this.ticketCounts[raffleId] || 0;

            // Зберігаємо оновлену кількість білетів
            this.ticketCounts[raffleId] = ticketCount;

            // Зберігаємо в localStorage
            this.saveTicketsToStorage();

            // Оновлюємо відображення білетів
            this.updateTicketDisplay(raffleId, ticketCount);

            // Додаємо транзакцію в історію
            this.addTransaction({
                type: 'participation',
                raffleId: raffleId,
                ticketCount: ticketCount,
                previousTicketCount: previousTicketCount,
                fee: this.entryFees[raffleId] || 1,
                timestamp: Date.now()
            });

            // Плануємо додаткову синхронізацію через 3 секунди
            if (this.syncTimer) {
                clearTimeout(this.syncTimer);
            }

            this.syncTimer = setTimeout(() => {
                console.log('🔄 Виконуємо відкладену перевірку стану білетів та балансу');
                // Синхронізуємо баланс першим
                this.syncServerBalance().then(() => {
                    // Потім оновлюємо білети
                    this.loadUserTickets(true);
                });
            }, 2000);
        },

        /**
         * Оновлення балансу на основі даних з сервера
         * @param {number} newBalance - Новий баланс з сервера
         */
        serverUpdateCoins: function(newBalance) {
            if (typeof newBalance !== 'number') return;

            // Запам'ятовуємо старий баланс для анімації
            const oldBalance = this.currentCoins;

            // Оновлюємо поточний баланс
            this.currentCoins = newBalance;

            // Оновлюємо відображення з анімацією
            const coinsElement = document.getElementById('user-coins');
            if (coinsElement) {
                coinsElement.textContent = this.currentCoins;

                // Додаємо анімацію зміни
                if (oldBalance > newBalance) {
                    coinsElement.classList.add('decreasing');
                    setTimeout(() => {
                        coinsElement.classList.remove('decreasing');
                    }, 1000);
                } else if (oldBalance < newBalance) {
                    coinsElement.classList.add('increasing');
                    setTimeout(() => {
                        coinsElement.classList.remove('increasing');
                    }, 1000);
                }
            }

            // Оновлюємо localStorage
            localStorage.setItem('userCoins', this.currentCoins.toString());
            localStorage.setItem('winix_coins', this.currentCoins.toString());

            // Зберігаємо серверний баланс
            this.lastServerBalance = newBalance;
            this.lastBalanceUpdateTime = Date.now();
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
                // Видаляємо клас processing
                button.classList.remove('processing');

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

                // Зберігаємо стан участі
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
         * Участь у розіграші - тепер без локального списання
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

            // Перевірка на таймер зворотного відліку
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

            // Створюємо таймер зворотного відліку для цього розіграшу
            this.cooldownTimers[raffleId] = setTimeout(() => {
                delete this.cooldownTimers[raffleId];
            }, this.minTransactionInterval);

            try {
                // Показуємо індикатор завантаження
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }

                // Запам'ятовуємо поточну кількість білетів
                const currentTicketCount = this.ticketCounts[raffleId] || 0;

                // Використовуємо тільки серверний запит для обробки участі в розіграші
                if (window.WinixRaffles &&
                    window.WinixRaffles.participation &&
                    typeof window.WinixRaffles.participation.participateInRaffle === 'function') {

                    const result = await window.WinixRaffles.participation.participateInRaffle(raffleId, entryCount);

                    // Обробка результату
                    if (result.success) {
                        // Оновлюємо кількість білетів тільки за даними з сервера
                        let newTicketCount;
                        if (result.data && typeof result.data.total_entries === 'number') {
                            newTicketCount = result.data.total_entries;
                        } else {
                            newTicketCount = currentTicketCount + entryCount;
                        }

                        this.ticketCounts[raffleId] = newTicketCount;

                        // Оновлюємо баланс лише за даними з сервера
                        if (result.data && typeof result.data.new_coins_balance === 'number') {
                            // Використовуємо нову функцію для оновлення серверного балансу
                            this.serverUpdateCoins(result.data.new_coins_balance);
                        } else {
                            // Якщо сервер не повернув баланс, запускаємо синхронізацію
                            console.warn("⚠️ Сервер не повернув дані про новий баланс, запускаємо синхронізацію");
                            setTimeout(() => this.syncServerBalance(), 1000);
                        }

                        // Зберігаємо в localStorage
                        this.saveTicketsToStorage();

                        // Генеруємо подію про успішну участь
                        document.dispatchEvent(new CustomEvent('raffle-participation', {
                            detail: {
                                successful: true,
                                raffleId: raffleId,
                                ticketCount: newTicketCount
                            }
                        }));

                        // Запланувати додаткову перевірку
                        setTimeout(() => {
                            this.syncServerBalance();
                            this.loadUserTickets(true);
                        }, 3000);
                    }

                    return result;
                } else {
                    // Помилка, якщо модуль participation недоступний
                    throw new Error('Модуль обробки участі недоступний. Спробуйте оновити сторінку.');
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

                // Повертаємо нормальний стан кнопок, якщо була помилка
                const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"].processing, .mini-raffle-button[data-raffle-id="${raffleId}"].processing`);
                buttons.forEach(button => {
                    // Якщо у нас немає білетів для цього розіграшу, відновлюємо кнопку
                    if (!this.ticketCounts[raffleId]) {
                        button.classList.remove('processing');
                        button.disabled = false;

                        // Відновлюємо оригінальний текст
                        const originalText = button.getAttribute('data-original-text');
                        if (originalText) {
                            button.textContent = originalText;
                        } else {
                            const entryFee = this.entryFees[raffleId] || 1;
                            button.textContent = button.classList.contains('mini-raffle-button') ?
                                'Взяти участь' :
                                `Взяти участь за ${entryFee} жетон${entryFee > 1 ? 'и' : ''}`;
                        }
                    }
                });
            }
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
                        button.textContent = `Взяти участь`;
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
            // Перевірка на активну транзакцію
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
                    // Встановлюємо флаг транзакції для запобігання конфліктам
                    this.isTransactionInProgress = true;

                    await window.WinixRaffles.participation.loadUserRaffles(true);

                    // Оновлюємо локальні дані
                    this.loadUserTickets(true);

                    // Оновлюємо відображення
                    Object.keys(this.ticketCounts).forEach(raffleId => {
                        this.updateTicketDisplay(raffleId, this.ticketCounts[raffleId]);
                    });

                    // Синхронізуємо баланс
                    await this.syncServerBalance();

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

                // Видаляємо клас processing
                button.classList.remove('processing');

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

                // Скидаємо стан кнопок
                this.resetParticipationButtons();
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
            /* Анімація зменшення кількості жетонів */
            @keyframes decrease-coins {
                0% { color: #FF5722; transform: scale(1.1); }
                100% { color: inherit; transform: scale(1); }
            }
            
            /* Анімація збільшення кількості жетонів */
            @keyframes increase-coins {
                0% { color: #4CAF50; transform: scale(1.1); }
                100% { color: inherit; transform: scale(1); }
            }
            
            #user-coins.decreasing {
                animation: decrease-coins 0.5s ease-out;
            }
            
            #user-coins.increasing {
                animation: increase-coins 0.5s ease-out;
            }
            
            /* Анімація мерехтіння для кнопок під час таймауту */
            @keyframes button-cooldown {
                0% { opacity: 0.8; }
                50% { opacity: 0.6; }
                100% { opacity: 0.8; }
            }
            
            /* Стилі для кнопок у стані очікування */
            .join-button.cooling-down,
            .mini-raffle-button.cooling-down {
                animation: button-cooldown 1s ease-in-out infinite;
                background: linear-gradient(90deg, #9e9e9e, #616161) !important;
                pointer-events: none;
            }
            
            /* Стилі для кнопок у процесі обробки */
            .join-button.processing,
            .mini-raffle-button.processing {
                opacity: 0.7;
                background: linear-gradient(90deg, #9e9e9e, #616161) !important;
                cursor: not-allowed;
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

    // Додаємо обробник для глобальних помилок
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

            // Скидаємо стан кнопок
            ticketManager.resetParticipationButtons();
        }
    });

    // Додаємо обробник для необроблених Promise-помилок
    window.addEventListener('unhandledrejection', function(event) {
        // Скидаємо стан транзакції при необроблених Promise-помилках
        if (ticketManager && ticketManager.isTransactionInProgress) {
            console.warn('⚠️ Виявлено необроблену Promise-помилку під час транзакції. Скидаємо стан.');
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

            // Скидаємо стан кнопок
            ticketManager.resetParticipationButtons();
        }
    });

    console.log('✅ Модуль управління білетами успішно завантажено');
})();