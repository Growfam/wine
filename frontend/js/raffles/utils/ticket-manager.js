/**
 * WINIX - Система розіграшів (ticket-manager.js)
 * Оптимізований модуль для управління білетами
 * Виправлено проблеми синхронізації з participation.js
 * @version 2.0.0
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше ticket-manager.js');
        return;
    }

    // Трекер показаних сповіщень для запобігання дублюванню
    const shownNotifications = new Set();

    // Модуль управління білетами
    const ticketManager = {
        // Дані про кількість білетів для кожного розіграшу
        ticketCounts: {},

        // Дані про вартість участі для кожного розіграшу
        entryFees: {},

        // Час останньої транзакції
        lastTransactionTime: 0,

        // Мінімальний інтервал між транзакціями (мс)
        minTransactionInterval: 2000, // 2 секунди

        // Стан таймера зворотного відліку
        cooldownTimers: {},

        // Таймер для відкладеної синхронізації
        syncTimer: null,

        // Індикатор завантаження даних
        isLoading: false,

        /**
         * Ініціалізація модуля
         */
        init: function() {
            console.log('🎟️ Ініціалізація модуля управління білетами...');

            // Очищення стану перед ініціалізацією
            this._cleanupState();

            // Завантажуємо кількість білетів користувача
            this.loadUserTickets();

            // Додаємо обробники подій
            this.setupEventHandlers();

            console.log('✅ Модуль управління білетами успішно ініціалізовано');
        },

        /**
         * Очищення стану перед ініціалізацією
         * @private
         */
        _cleanupState: function() {
            // Очищення таймеру синхронізації
            if (this.syncTimer) {
                clearTimeout(this.syncTimer);
                this.syncTimer = null;
            }

            // Очищення таймерів зворотного відліку
            for (const timerId in this.cooldownTimers) {
                if (this.cooldownTimers.hasOwnProperty(timerId)) {
                    clearTimeout(this.cooldownTimers[timerId]);
                }
            }
            this.cooldownTimers = {};

            // Скидаємо стан завантаження
            this.isLoading = false;
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
            document.addEventListener('balance-updated', (event) => {
                if (event.detail && event.detail.newBalance !== undefined) {
                    // Отримуємо джерело оновлення
                    const source = event.detail.source || 'unknown';

                    // Якщо це не наша подія і не participation, перевіряємо дані участі
                    if (source !== 'ticket-manager' && source !== 'participation.js') {
                        setTimeout(() => {
                            this.syncWithServer();
                        }, 1000);
                    }
                }
            });

            // Обробник кліків на кнопки участі з використанням делегування
            document.addEventListener('click', (event) => {
                const participateButton = event.target.closest('.join-button, .mini-raffle-button');
                if (!participateButton) return;

                // Перевіряємо чи не заблокована кнопка
                if (participateButton.disabled || participateButton.classList.contains('processing')) {
                    event.preventDefault();
                    return;
                }

                const raffleId = participateButton.getAttribute('data-raffle-id');
                if (!raffleId) return;

                // Перевірка на таймер зворотного відліку
                if (this.cooldownTimers[raffleId]) {
                    event.preventDefault();
                    this._showToast('Будь ласка, зачекайте перед наступною спробою', 'info');
                    return;
                }

                // Запам'ятовуємо вартість участі
                const entryFee = parseInt(participateButton.getAttribute('data-entry-fee')) || 1;
                this.entryFees[raffleId] = entryFee;

                // Перевіряємо баланс перед кліком
                const userCoins = this.getUserCoins();
                if (userCoins < entryFee) {
                    event.preventDefault();
                    this._showToast(`Недостатньо жетонів. Потрібно: ${entryFee}, у вас: ${userCoins}`, 'warning');
                    return;
                }

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

            // Обробник для оновлення при зміні видимості сторінки
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && !this.isLoading) {
                    // При поверненні на сторінку перевіряємо дані
                    this.syncWithServer();
                }
            });
        },

        /**
         * Показ сповіщення без дублювання
         * @param {string} message - Текст повідомлення
         * @param {string} type - Тип повідомлення (info, warning, error, success)
         * @private
         */
        _showToast: function(message, type = 'info') {
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
         * Отримання поточної кількості жетонів користувача
         * @returns {number} Кількість жетонів
         */
        getUserCoins: function() {
            try {
                // Створюємо дані для логування
                const debugData = {
                    sources: {},
                    selectedSource: '',
                    selectedValue: 0
                };

                // 1. Перевіряємо останні серверні дані в localStorage
                // Встановлюємо найвищий пріоритет для серверного балансу
                const serverTimestamp = parseInt(localStorage.getItem('winix_server_balance_ts') || '0');
                const serverBalance = parseInt(localStorage.getItem('winix_server_balance') || '0');

                // Якщо серверні дані існують і не старші 2 хвилин, використовуємо їх
                if (serverBalance > 0 && serverTimestamp > 0 && (Date.now() - serverTimestamp < 120000)) {
                    debugData.sources.server = serverBalance;
                    debugData.selectedSource = 'server';
                    debugData.selectedValue = serverBalance;

                    return serverBalance;
                }

                // 2. Перевіряємо глобальний контролер синхронізації
                if (window.__winixSyncControl &&
                    window.__winixSyncControl.lastValidBalance !== null &&
                    typeof window.__winixSyncControl.lastValidBalance === 'number') {

                    debugData.sources.syncControl = window.__winixSyncControl.lastValidBalance;
                    debugData.selectedSource = 'syncControl';
                    debugData.selectedValue = window.__winixSyncControl.lastValidBalance;

                    return window.__winixSyncControl.lastValidBalance;
                }

                // 3. Перевіряємо WinixCore
                if (window.WinixCore && typeof window.WinixCore.getCoins === 'function') {
                    const coreCoins = window.WinixCore.getCoins();
                    if (typeof coreCoins === 'number' && !isNaN(coreCoins) && coreCoins >= 0) {
                        debugData.sources.winixCore = coreCoins;
                        debugData.selectedSource = 'winixCore';
                        debugData.selectedValue = coreCoins;

                        return coreCoins;
                    }
                }

                // 4. Перевіряємо участь
                if (window.WinixRaffles && window.WinixRaffles.participation &&
                    window.WinixRaffles.participation.lastKnownBalance !== null) {

                    debugData.sources.participation = window.WinixRaffles.participation.lastKnownBalance;

                    // Перевіряємо як давно було оновлення
                    const participationUpdateTime = window.WinixRaffles.participation.lastBalanceUpdateTime || 0;
                    const storedUpdateTime = parseInt(localStorage.getItem('winix_balance_update_time') || '0');

                    // Якщо дані participation свіжіші, використовуємо їх
                    if (participationUpdateTime > storedUpdateTime) {
                        debugData.selectedSource = 'participation';
                        debugData.selectedValue = window.WinixRaffles.participation.lastKnownBalance;

                        return window.WinixRaffles.participation.lastKnownBalance;
                    }
                }

                // 5. Перевіряємо DOM
                const userCoinsElement = document.getElementById('user-coins');
                if (userCoinsElement) {
                    const domCoins = parseInt(userCoinsElement.textContent);
                    if (!isNaN(domCoins) && domCoins >= 0) {
                        debugData.sources.dom = domCoins;

                        // Використовуємо DOM тільки якщо немає свіжіших даних
                        const domUpdateTime = parseInt(localStorage.getItem('winix_balance_update_time') || '0');

                        if (domUpdateTime > serverTimestamp) {
                            debugData.selectedSource = 'dom';
                            debugData.selectedValue = domCoins;

                            return domCoins;
                        }
                    }
                }

                // 6. Використовуємо localStorage як останній варіант
                const storedCoins = parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins') || '0');
                debugData.sources.localStorage = storedCoins;
                debugData.selectedSource = 'localStorage';
                debugData.selectedValue = storedCoins;

                return !isNaN(storedCoins) ? storedCoins : 0;
            } catch (error) {
                console.error('❌ Помилка отримання балансу в ticket-manager:', error);

                // Безпечне повернення при помилці
                try {
                    return parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins') || '0') || 0;
                } catch (e) {
                    return 0;
                }
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
                    // Спробуємо витягти з тексту кнопки
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
         * Завантаження кількості білетів користувача
         * @param {boolean} forceRefresh - Примусове оновлення
         */
        loadUserTickets: function(forceRefresh = false) {
            // Запобігаємо паралельним запитам
            if (this.isLoading && !forceRefresh) {
                console.log('🎟️ Завантаження білетів вже виконується');
                return;
            }

            // Перевірка необхідності оновлення
            if (!forceRefresh && Object.keys(this.ticketCounts).length > 0) {
                console.log('🎟️ Використовуємо кешовані дані про білети');
                return;
            }

            console.log('🎟️ Оновлення даних про білети');
            this.isLoading = true;

            // Зберігаємо попередній стан для порівняння
            const previousTickets = {...this.ticketCounts};

            try {
                // Отримуємо дані з WinixRaffles.participation (пріоритетне джерело)
                if (window.WinixRaffles && window.WinixRaffles.participation) {
                    const participation = window.WinixRaffles.participation;

                    // Очищаємо поточні дані
                    this.ticketCounts = {};

                    // Заповнюємо з даних participation
                    if (participation.participatingRaffles && participation.userRaffleTickets) {
                        participation.participatingRaffles.forEach(raffleId => {
                            // Отримуємо кількість білетів
                            const ticketCount = participation.userRaffleTickets[raffleId] || 1;
                            this.ticketCounts[raffleId] = ticketCount;
                        });
                    }
                } else {
                    // Запасний варіант - намагаємося отримати з localStorage
                    try {
                        const savedTickets = localStorage.getItem('winix_user_tickets');
                        if (savedTickets) {
                            const parsedTickets = JSON.parse(savedTickets);
                            // Об'єднуємо з поточними даними
                            this.ticketCounts = {...parsedTickets};
                        }
                    } catch (e) {
                        console.warn('⚠️ Помилка завантаження даних про білети з localStorage:', e);
                    }
                }

                // Перевіряємо зміни
                let hasChanges = false;

                // Порівнюємо новий і старий стан
                for (const raffleId in this.ticketCounts) {
                    if (previousTickets[raffleId] !== this.ticketCounts[raffleId]) {
                        hasChanges = true;
                        break;
                    }
                }

                for (const raffleId in previousTickets) {
                    if (this.ticketCounts[raffleId] === undefined) {
                        hasChanges = true;
                        break;
                    }
                }

                if (hasChanges || forceRefresh) {
                    console.log('🎟️ Оновлені дані про білети:', this.ticketCounts);
                    this.saveTicketsToStorage();
                    this.updateTicketsUI();
                }
            } catch (error) {
                console.error('❌ Помилка завантаження білетів:', error);
            } finally {
                this.isLoading = false;
            }
        },

        /**
         * Оновлення відображення кількості білетів
         */
        updateTicketsUI: function() {
            // Перебираємо всі кнопки
            for (const raffleId in this.ticketCounts) {
                const ticketCount = this.ticketCounts[raffleId];
                const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);

                buttons.forEach(button => {
                    // Змінюємо текст кнопки, тільки якщо вона не обробляється
                    if (!button.classList.contains('processing')) {
                        const isMini = button.classList.contains('mini-raffle-button');
                        if (ticketCount > 0) {
                            button.classList.add('participating');
                            button.textContent = isMini ?
                                `Додати ще білет (${ticketCount})` :
                                `Додати ще білет (у вас: ${ticketCount})`;
                        }
                    }
                });
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

            // Розклад відкладеного оновлення
            if (this.syncTimer) clearTimeout(this.syncTimer);
            this.syncTimer = setTimeout(() => {
                this.syncWithServer();
            }, 3000);

            console.log(`✅ Оновлено кількість білетів для розіграшу ${raffleId}: ${ticketCount}`);
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
         * Участь у розіграші - делегуємо модулю participation
         * @param {string} raffleId - ID розіграшу
         * @param {number} entryCount - Кількість білетів для додавання
         * @returns {Promise<Object>} Результат участі
         */
        participateInRaffle: async function(raffleId, entryCount = 1) {
            try {
                // Перевірка наявності модуля participation
                if (!window.WinixRaffles ||
                    !window.WinixRaffles.participation ||
                    typeof window.WinixRaffles.participation.participateInRaffle !== 'function') {

                    console.error('❌ Модуль participation недоступний');
                    this._showToast('Модуль обробки участі недоступний. Оновіть сторінку.', 'error');
                    return {
                        success: false,
                        message: 'Модуль обробки участі недоступний. Оновіть сторінку.'
                    };
                }

                // Перевірка балансу
                const userCoins = this.getUserCoins();
                const entryFee = this.getEntryFee(raffleId) || 1;

                if (userCoins < entryFee) {
                    this._showToast(`Недостатньо жетонів. Потрібно: ${entryFee}, у вас: ${userCoins}`, 'warning');
                    return {
                        success: false,
                        message: `Недостатньо жетонів. Потрібно: ${entryFee}, у вас: ${userCoins}`
                    };
                }

                console.log('🔄 Делегування запиту участі модулю participation...');

                // Викликаємо метод participation
                const result = await window.WinixRaffles.participation.participateInRaffle(raffleId, 'delegate', entryCount);

                // Обробка результату
                if (result.success) {
                    // Запам'ятовуємо квитки локально
                    if (result.data && typeof result.data.total_entries === 'number') {
                        this.ticketCounts[raffleId] = result.data.total_entries;
                        this.saveTicketsToStorage();
                        this.updateTicketsUI();
                    }
                }

                return result;
            } catch (error) {
                console.error('❌ Помилка делегування запиту участі:', error);
                this._showToast(error.message || 'Помилка при спробі участі в розіграші', 'error');
                return {
                    success: false,
                    message: error.message || 'Внутрішня помилка делегування запиту участі'
                };
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
                if (!button.classList.contains('participating') && !button.classList.contains('processing')) {
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
            // Запобігаємо паралельним викликам
            if (this.isLoading) {
                return false;
            }

            this.isLoading = true;

            try {
                // Використовуємо рідний метод participation
                if (window.WinixRaffles && window.WinixRaffles.participation) {
                    const result = await window.WinixRaffles.participation.loadUserRaffles(true);

                    // Оновлюємо наші дані після синхронізації
                    this.loadUserTickets(true);

                    return result.success;
                } else {
                    // Якщо participation недоступний, завантажуємо самі
                    this.loadUserTickets(true);
                    return true;
                }
            } catch (error) {
                console.warn('⚠️ Помилка синхронізації з сервером:', error);
                return false;
            } finally {
                this.isLoading = false;
            }
        },

        /**
         * Скидання стану
         */
        reset: function() {
            console.log('🔄 Скидання стану ticket-manager...');

            // Очищення таймерів
            this._cleanupState();

            // Очищення даних
            this.ticketCounts = {};
            this.entryFees = {};
            this.lastTransactionTime = 0;

            // Збереження порожніх даних
            this.saveTicketsToStorage();

            console.log('✅ Стан ticket-manager успішно скинуто');
        }
    };

    // Додаємо модуль до головного модуля розіграшів
    window.WinixRaffles.ticketManager = ticketManager;

    // Ініціалізація модуля
    document.addEventListener('DOMContentLoaded', function() {
        if (window.WinixRaffles.state.isInitialized) {
            ticketManager.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                ticketManager.init();
            });
        }
    });

    console.log('✅ Модуль управління білетами успішно завантажено');
})();