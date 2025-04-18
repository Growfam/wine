/**
 * WINIX - Система розіграшів (ticket-manager.js)
 * Модуль для коректного управління білетами та жетонами
 * @version 1.0.0
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
        minTransactionInterval: 600,

        // Історія транзакцій
        transactionHistory: [],

        // Максимальний розмір історії транзакцій
        maxHistorySize: 50,

        /**
         * Ініціалізація модуля
         */
        init: function() {
            console.log('🎟️ Ініціалізація модуля управління білетами...');

            // Оновлюємо доступну кількість жетонів
            this.updateCurrentCoins();

            // Завантажуємо кількість білетів користувача
            this.loadUserTickets();

            // Додаємо обробники подій
            this.setupEventHandlers();
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
                }
            });

            // Обробник натискання на кнопки участі
            document.addEventListener('click', (event) => {
                const participateButton = event.target.closest('.join-button, .mini-raffle-button');
                if (!participateButton) return;

                // Перевіряємо чи це кнопка для вже існуючої участі
                if (participateButton.classList.contains('participating')) {
                    const raffleId = participateButton.getAttribute('data-raffle-id');
                    if (raffleId) {
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
                    }
                }
            });

            // Обробник завантаження розіграшів
            document.addEventListener('raffles-loaded', () => {
                this.extractEntryFeesFromDOM();
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
         */
        loadUserTickets: function() {
            // Скидаємо попередній стан
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
                fee: this.entryFees[raffleId] || 1,
                timestamp: Date.now()
            });
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

            try {
                // Показуємо індикатор завантаження
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }

                // Генеруємо унікальний ID транзакції
                const transactionId = `${raffleId}_${now}_${this.transactionCounter++}`;

                // Запит до API через основний модуль participation
                if (window.WinixRaffles &&
                    window.WinixRaffles.participation &&
                    typeof window.WinixRaffles.participation.participateInRaffle === 'function') {

                    const result = await window.WinixRaffles.participation.participateInRaffle(raffleId, entryCount);

                    // Обробка результату
                    if (result.success) {
                        // Оновлюємо кількість білетів
                        const newTicketCount = (this.ticketCounts[raffleId] || 0) + entryCount;
                        this.ticketCounts[raffleId] = newTicketCount;

                        // Зменшуємо кількість жетонів
                        this.updateCurrentCoins(this.currentCoins - (entryFee * entryCount));

                        // Зберігаємо в localStorage
                        this.saveTicketsToStorage();

                        // Генеруємо подію про успішну участь
                        this.triggerParticipationEvent(raffleId, newTicketCount);
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
                                _transaction_id: transactionId
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
                                    _transaction_id: transactionId
                                })
                            });

                            response = await fetchResponse.json();
                        }

                        // Обробка результату
                        if (response && response.status === 'success') {
                            // Оновлюємо кількість білетів
                            const newTicketCount = (this.ticketCounts[raffleId] || 0) + entryCount;
                            this.ticketCounts[raffleId] = newTicketCount;

                            // Зменшуємо кількість жетонів
                            this.updateCurrentCoins(this.currentCoins - (entryFee * entryCount));

                            // Зберігаємо в localStorage
                            this.saveTicketsToStorage();

                            // Генеруємо подію про успішну участь
                            this.triggerParticipationEvent(raffleId, newTicketCount);

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
            // Завантажуємо актуальні дані про участь користувача
            if (window.WinixRaffles &&
                window.WinixRaffles.participation &&
                typeof window.WinixRaffles.participation.loadUserRaffles === 'function') {

                try {
                    await window.WinixRaffles.participation.loadUserRaffles(true);

                    // Оновлюємо локальні дані
                    this.loadUserTickets();

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
        },

        /**
         * Створення HTML для модального вікна з деталями розіграшу
         * @param {Object} raffle - Дані розіграшу
         * @returns {string} HTML модального вікна
         */
        createRaffleDetailsHTML: function(raffle) {
            if (!raffle) return '';

            // Отримуємо кількість білетів користувача
            const userTickets = this.getTicketCount(raffle.id) || 0;

            // Форматуємо дату
            const endDate = new Date(raffle.end_time);
            const formattedDate = `${endDate.getDate().toString().padStart(2, '0')}.${(endDate.getMonth() + 1).toString().padStart(2, '0')}.${endDate.getFullYear()} ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

            // Створюємо HTML
            return `
                <div class="raffle-details-modal">
                    <div class="raffle-details-header">
                        <h3>${raffle.title || 'Деталі розіграшу'}</h3>
                        <button class="raffle-details-close">&times;</button>
                    </div>
                    
                    <div class="raffle-details-body">
                        <div class="raffle-details-image">
                            <img src="${raffle.image_url || 'assets/prize-default.png'}" alt="${raffle.title}"
                                 onerror="this.src='assets/prize-default.png'">
                        </div>
                        
                        <div class="raffle-details-info">
                            <div class="detail-row">
                                <div class="detail-label">Призовий фонд:</div>
                                <div class="detail-value">${raffle.prize_amount || 0} ${raffle.prize_currency || 'WINIX'}</div>
                            </div>
                            
                            <div class="detail-row">
                                <div class="detail-label">Кількість переможців:</div>
                                <div class="detail-value">${raffle.winners_count || 1}</div>
                            </div>
                            
                            <div class="detail-row">
                                <div class="detail-label">Вартість участі:</div>
                                <div class="detail-value">${raffle.entry_fee || 1} жетон${raffle.entry_fee > 1 ? 'и' : ''}</div>
                            </div>
                            
                            <div class="detail-row">
                                <div class="detail-label">Учасників:</div>
                                <div class="detail-value">${raffle.participants_count || 0}</div>
                            </div>
                            
                            <div class="detail-row">
                                <div class="detail-label">Завершення:</div>
                                <div class="detail-value">${formattedDate}</div>
                            </div>
                            
                            <div class="detail-row">
                                <div class="detail-label">Ваша участь:</div>
                                <div class="detail-value">${userTickets > 0 ? `${userTickets} білет${userTickets > 1 ? 'ів' : ''}` : 'Ви не берете участь'}</div>
                            </div>
                        </div>
                        
                        <div class="raffle-details-description">
                            <h4>Опис розіграшу:</h4>
                            <p>${raffle.description || 'Інформація відсутня'}</p>
                        </div>
                        
                        <div class="raffle-details-distribution">
                            <h4>Розподіл призів:</h4>
                            ${this.createPrizeDistributionHTML(raffle)}
                        </div>
                        
                        <div class="raffle-details-actions">
                            ${userTickets > 0 ?
                                `<button class="add-ticket-button" data-raffle-id="${raffle.id}">Додати ще білет</button>` :
                                `<button class="participate-button" data-raffle-id="${raffle.id}">Взяти участь за ${raffle.entry_fee || 1} жетон${raffle.entry_fee > 1 ? 'и' : ''}</button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Створення HTML для розподілу призів
         * @param {Object} raffle - Дані розіграшу
         * @returns {string} HTML розподілу призів
         */
        createPrizeDistributionHTML: function(raffle) {
            // Якщо є готовий розподіл призів, використовуємо його
            if (raffle.prize_distribution && Array.isArray(raffle.prize_distribution)) {
                return `
                    <div class="prize-distribution-list">
                        ${raffle.prize_distribution.map((prize, index) => `
                            <div class="prize-item">
                                <div class="prize-place">${index + 1} місце:</div>
                                <div class="prize-value">${prize.amount || prize} ${prize.currency || raffle.prize_currency || 'WINIX'}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // Якщо є кількість переможців, але немає розподілу, генеруємо типовий розподіл
            if (raffle.winners_count > 1) {
                // Для розіграшів з кількома переможцями створюємо розподіл за замовчуванням
                const prizes = [];
                const totalPrize = raffle.prize_amount || 1000;
                const winnersCount = raffle.winners_count || 3;

                // Розподіляємо призовий фонд за замовчуванням
                // 1 місце - 50%, 2 місце - 30%, 3 місце і далі - решта порівну
                if (winnersCount === 2) {
                    prizes.push({ place: 1, amount: Math.round(totalPrize * 0.7) });
                    prizes.push({ place: 2, amount: Math.round(totalPrize * 0.3) });
                } else if (winnersCount === 3) {
                    prizes.push({ place: 1, amount: Math.round(totalPrize * 0.5) });
                    prizes.push({ place: 2, amount: Math.round(totalPrize * 0.3) });
                    prizes.push({ place: 3, amount: Math.round(totalPrize * 0.2) });
                } else {
                    // Для більшої кількості переможців
                    prizes.push({ place: 1, amount: Math.round(totalPrize * 0.5) });
                    prizes.push({ place: 2, amount: Math.round(totalPrize * 0.3) });

                    // Розподіляємо решту порівну
                    const restAmount = Math.round(totalPrize * 0.2);
                    const restPerWinner = Math.round(restAmount / (winnersCount - 2));

                    for (let i = 3; i <= winnersCount; i++) {
                        prizes.push({ place: i, amount: restPerWinner });
                    }
                }

                // Генеруємо HTML
                return `
                    <div class="prize-distribution-list">
                        ${prizes.map(prize => `
                            <div class="prize-item">
                                <div class="prize-place">${prize.place} місце:</div>
                                <div class="prize-value">${prize.amount} ${raffle.prize_currency || 'WINIX'}</div>
                            </div>
                        `).join('')}
                    </div>
                    <p class="prize-note">Примітка: це типовий розподіл призового фонду, який може бути змінено організатором.</p>
                `;
            }

            // Для одного переможця просто показуємо загальний призовий фонд
            return `
                <div class="prize-distribution-single">
                    <div class="prize-item">
                        <div class="prize-place">Приз переможцю:</div>
                        <div class="prize-value">${raffle.prize_amount || 1000} ${raffle.prize_currency || 'WINIX'}</div>
                    </div>
                </div>
            `;
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
            
            /* Стилі для модального вікна з деталями розіграшу */
            .raffle-details-modal {
                background: #fff;
                border-radius: 10px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
            }
            
            .raffle-details-header {
                background: linear-gradient(to right, #4eb5f7, #00dfd1);
                color: white;
                padding: 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 10px 10px 0 0;
            }
            
            .raffle-details-header h3 {
                margin: 0;
                font-size: 18px;
            }
            
            .raffle-details-close {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                opacity: 0.8;
                transition: opacity 0.2s;
            }
            
            .raffle-details-close:hover {
                opacity: 1;
            }
            
            .raffle-details-body {
                padding: 15px;
            }
            
            .raffle-details-image {
                text-align: center;
                margin-bottom: 15px;
            }
            
            .raffle-details-image img {
                max-width: 100%;
                max-height: 200px;
                border-radius: 8px;
                box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
            }
            
            .raffle-details-info {
                margin-bottom: 20px;
            }
            
            .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 1px solid #eee;
            }
            
            .detail-label {
                color: #666;
                font-size: 14px;
            }
            
            .detail-value {
                font-weight: bold;
                color: #333;
            }
            
            .raffle-details-description {
                margin-bottom: 20px;
            }
            
            .raffle-details-description h4 {
                margin-top: 0;
                color: #333;
                font-size: 16px;
            }
            
            .raffle-details-description p {
                color: #666;
                line-height: 1.5;
            }
            
            .raffle-details-distribution {
                margin-bottom: 20px;
            }
            
            .raffle-details-distribution h4 {
                margin-top: 0;
                color: #333;
                font-size: 16px;
            }
            
            .prize-distribution-list {
                background-color: #f9f9f9;
                border-radius: 8px;
                padding: 10px;
            }
            
            .prize-item {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                border-bottom: 1px dashed #ddd;
            }
            
            .prize-item:last-child {
                border-bottom: none;
            }
            
            .prize-place {
                font-weight: bold;
                color: #333;
            }
            
            .prize-value {
                color: #4CAF50;
                font-weight: bold;
            }
            
            .prize-note {
                font-size: 12px;
                color: #999;
                font-style: italic;
                margin-top: 5px;
            }
            
            .raffle-details-actions {
                text-align: center;
                margin-top: 20px;
            }
            
            .participate-button, .add-ticket-button {
                background: linear-gradient(to right, #4eb5f7, #00dfd1);
                color: white;
                border: none;
                border-radius: 20px;
                padding: 10px 20px;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.3s;
                box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
            }
            
            .participate-button:hover, .add-ticket-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
            }
            
            .participate-button:active, .add-ticket-button:active {
                transform: translateY(0);
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            }
            
            .add-ticket-button {
                background: linear-gradient(to right, #4CAF50, #8BC34A);
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

    console.log('✅ Модуль управління білетами успішно завантажено');
})();