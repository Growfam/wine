/**
 * WINIX - Система розіграшів (ticket-manager.js)
 * Оптимізований модуль для управління білетами без дублювання логіки
 * Покращена робота з DOM та кешування для зменшення навантаження
 * @version 1.6.0
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

        // Час останньої транзакції
        lastTransactionTime: 0,

        // Мінімальний інтервал між транзакціями (мс)
        minTransactionInterval: 2000, // 2 секунди між запитами

        // Стан таймера зворотного відліку
        cooldownTimers: {},

        // Таймер для відкладеної синхронізації
        syncTimer: null,

        // Індикатор, що дані потребують оновлення з сервера
        needsServerUpdate: false,

        // Кеш DOM елементів для оптимізації доступу
        domCache: {
            // Елемент балансу
            userCoins: null,
            // Кнопки за ID розіграшу
            buttons: {},
            // Кількість учасників за ID розіграшу
            participants: {},
            // Час останнього оновлення кеша
            lastCacheUpdate: 0,
            // Інтервал автоматичного очищення кеша (мс)
            cacheLifetime: 30000 // 30 секунд
        },

        /**
         * Ініціалізація модуля
         */
        init: function() {
            console.log('🎟️ Ініціалізація модуля управління білетами...');

            // Очищення стану перед ініціалізацією
            this._cleanupState();

            // Ініціалізуємо кеш DOM елементів
            this.initDOMCache();

            // Завантажуємо кількість білетів користувача
            this.loadUserTickets();

            // Додаємо обробники подій
            this.setupEventHandlers();

            // Силове оновлення даних після затримки
            setTimeout(() => {
                this.loadUserTickets(true);
            }, 2000);

            // Запускаємо періодичне очищення кеша
            setInterval(() => {
                this.cleanupDOMCache();
            }, 60000); // Раз на хвилину

            console.log('✅ Модуль управління білетами успішно ініціалізовано');
        },

        /**
         * Ініціалізація кеша DOM елементів
         */
        initDOMCache: function() {
            // Кешуємо елемент балансу
            this.domCache.userCoins = document.getElementById('user-coins');

            // Оновлюємо час кешування
            this.domCache.lastCacheUpdate = Date.now();

            console.log('✅ Кеш DOM елементів ініціалізовано');
        },

        /**
         * Очищення кеша DOM елементів
         */
        cleanupDOMCache: function() {
            const now = Date.now();

            // Очищаємо кеш, якщо він старший за cacheLifetime
            if (now - this.domCache.lastCacheUpdate > this.domCache.cacheLifetime) {
                this.domCache.buttons = {};
                this.domCache.participants = {};

                // Оновлюємо елемент балансу
                this.domCache.userCoins = document.getElementById('user-coins');

                // Оновлюємо час очищення
                this.domCache.lastCacheUpdate = now;

                console.log('🧹 Кеш DOM елементів ticket-manager очищено');
            }
        },

        /**
         * Отримання кешованого DOM елементу
         * @param {string} type - Тип елемента (userCoins, buttons, participants)
         * @param {string} id - ID елемента (для кнопок та лічильників)
         * @param {Function} selector - Функція для вибору елемента, якщо він не кешований
         * @returns {HTMLElement|HTMLElement[]|null} - Елемент або масив елементів
         */
        getDOMElement: function(type, id, selector) {
            // Якщо це елемент балансу
            if (type === 'userCoins') {
                if (!this.domCache.userCoins) {
                    this.domCache.userCoins = document.getElementById('user-coins');
                }
                return this.domCache.userCoins;
            }

            // Для інших типів з ID
            if (!id || !selector) return null;

            // Перевіряємо кеш
            const cache = this.domCache[type];
            if (cache && cache[id]) {
                return cache[id];
            }

            // Отримуємо елемент через селектор
            const element = selector();

            // Кешуємо елемент, якщо він існує
            if (element) {
                if (!this.domCache[type]) {
                    this.domCache[type] = {};
                }
                this.domCache[type][id] = element;
            }

            return element;
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

            // Скидаємо прапорець оновлення
            this.needsServerUpdate = false;
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
                    // Оновлюємо дані про білети тільки якщо це не наша подія
                    if (event.detail.source !== 'ticket-manager') {
                        // ВИПРАВЛЕННЯ: збільшуємо затримку для більшої стабільності
                        setTimeout(() => {
                            this.loadUserTickets(true);
                        }, 2000);
                    }
                }
            });

            // Обробник завантаження розіграшів
            document.addEventListener('raffles-loaded', () => {
                // Скидаємо кеш DOM елементів
                this.domCache.buttons = {};
                this.domCache.participants = {};

                // Витягуємо вартість участі з DOM
                this.extractEntryFeesFromDOM();

                // Оновлюємо дані про білети
                setTimeout(() => {
                    this.loadUserTickets();
                }, 1000);
            });

            // Покращений обробник натискання на кнопки участі використовуючи делегування подій
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

                // ВИПРАВЛЕННЯ: Перевіряємо баланс перед кліком
                const userCoins = this.getUserCoins();
                if (userCoins < entryFee) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (typeof window.showToast === 'function') {
                        window.showToast(`Недостатньо жетонів. Потрібно: ${entryFee}, у вас: ${userCoins}`, 'warning');
                    }
                    return;
                }

                // ВИПРАВЛЕННЯ: Створюємо таймер зворотного відліку для цього розіграшу
                this.cooldownTimers[raffleId] = setTimeout(() => {
                    delete this.cooldownTimers[raffleId];
                }, this.minTransactionInterval);
            });

            // ДОДАНО: Обробник для оновлення при зміні видимості сторінки
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && this.needsServerUpdate) {
                    console.log('🔄 Оновлюємо дані про білети після повернення на сторінку');
                    this.loadUserTickets(true);
                    this.needsServerUpdate = false;
                }
            });
        },

        /**
         * Отримання поточної кількості жетонів користувача
         * @returns {number} Кількість жетонів
         */
        getUserCoins: function() {
            // Спочатку перевіряємо WinixCore
            if (window.WinixCore && typeof window.WinixCore.getCoins === 'function') {
                return window.WinixCore.getCoins();
            }

            // Потім спробуємо отримати з DOM кешу
            const userCoinsElement = this.getDOMElement('userCoins');
            if (userCoinsElement) {
                return parseInt(userCoinsElement.textContent) || 0;
            }

            // Як останній варіант - з localStorage
            return parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins')) || 0;
        },

        /**
         * Витягування вартості участі з DOM
         */
        extractEntryFeesFromDOM: function() {
            // Оптимізоване отримання всіх кнопок одним запитом
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

                // Кешуємо кнопку для подальшого використання
                if (!this.domCache.buttons[raffleId]) {
                    this.domCache.buttons[raffleId] = [];
                }
                this.domCache.buttons[raffleId].push(button);
            });
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

            // Скидаємо прапорець потреби в оновленні
            this.needsServerUpdate = false;

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

                // ДОДАНО: Оновлення інтерфейсу після оновлення даних
                this.updateTicketsUI();
            }
        },

        /**
         * Оновлення відображення кількості білетів
         */
        updateTicketsUI: function() {
            // Оптимізований метод з використанням кешу DOM
            for (const raffleId in this.ticketCounts) {
                const ticketCount = this.ticketCounts[raffleId];

                // Отримуємо кнопки з кешу або шукаємо їх в DOM
                const buttons = this.getDOMElement('buttons', raffleId, () => {
                    return document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
                });

                if (!buttons || !buttons.length) continue;

                // Перебираємо і оновлюємо всі кнопки
                buttons.forEach(button => {
                    const isMini = button.classList.contains('mini-raffle-button');
                    if (ticketCount > 0) {
                        // Додаємо клас для учасників
                        button.classList.add('participating');

                        // Змінюємо текст кнопки
                        button.textContent = isMini ?
                            `Додати ще білет (${ticketCount})` :
                            `Додати ще білет (у вас: ${ticketCount})`;
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

            // Оновлюємо вигляд кнопок
            this.updateButtons(raffleId, ticketCount);

            // ВИПРАВЛЕННЯ: Встановлюємо прапорець оновлення
            this.needsServerUpdate = true;

            // ВИПРАВЛЕННЯ: Розклад відкладеного оновлення для стабільності
            if (this.syncTimer) clearTimeout(this.syncTimer);
            this.syncTimer = setTimeout(() => {
                this.loadUserTickets(true);
            }, 3000);

            console.log(`✅ Оновлено кількість білетів для розіграшу ${raffleId}: ${ticketCount}`);
        },

        /**
         * Оновлення вигляду кнопок
         * @param {string} raffleId - ID розіграшу
         * @param {number} ticketCount - Кількість білетів
         */
        updateButtons: function(raffleId, ticketCount) {
            // Отримуємо кнопки з кешу або шукаємо їх в DOM
            const buttons = this.getDOMElement('buttons', raffleId, () => {
                return document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
            });

            if (!buttons || !buttons.length) return;

            // Перебираємо і оновлюємо всі кнопки
            buttons.forEach(button => {
                // Видаляємо стан обробки
                button.classList.remove('processing');
                button.removeAttribute('data-processing');

                // Додаємо клас для учасників
                button.classList.add('participating');

                // Змінюємо текст кнопки
                const isMini = button.classList.contains('mini-raffle-button');
                button.textContent = isMini ?
                    `Додати ще білет (${ticketCount})` :
                    `Додати ще білет (у вас: ${ticketCount})`;

                // Розблоковуємо кнопку
                button.disabled = false;
            });
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
            // ВИПРАВЛЕНО: Делегуємо цю функцію модулю participation
            if (window.WinixRaffles &&
                window.WinixRaffles.participation &&
                typeof window.WinixRaffles.participation.participateInRaffle === 'function') {

                console.log('🔄 Делегування запиту участі модулю participation...');
                return await window.WinixRaffles.participation.participateInRaffle(raffleId, 'delegate', entryCount);
            } else {
                console.error('❌ Модуль participation недоступний. Не можна взяти участь у розіграші');
                return {
                    success: false,
                    message: 'Модуль обробки участі недоступний. Оновіть сторінку.'
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

            // Оновлюємо атрибути кнопок, використовуючи кешовані елементи
            const buttons = this.getDOMElement('buttons', raffleId, () => {
                return document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
            });

            if (!buttons || !buttons.length) return;

            // Перебираємо і оновлюємо всі кнопки
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
         * Синхронізація з сервером - делегуємо модулю participation
         * @returns {Promise<boolean>} Результат синхронізації
         */
        syncWithServer: async function() {
            // ВИПРАВЛЕНО: Делегуємо модулю participation або WinixCore
            if (window.WinixCore && typeof window.WinixCore.syncUserData === 'function') {
                console.log('🔄 Делегування запиту синхронізації до WinixCore...');
                const result = await window.WinixCore.syncUserData();
                return result.success;
            } else if (window.WinixRaffles &&
                window.WinixRaffles.participation &&
                typeof window.WinixRaffles.participation.syncWithServer === 'function') {

                console.log('🔄 Делегування запиту синхронізації модулю participation...');
                return await window.WinixRaffles.participation.syncWithServer();
            } else {
                console.warn('⚠️ Модулі синхронізації недоступні. Не можна синхронізувати дані');
                return false;
            }
        },

        /**
         * Скидання стану
         */
        reset: function() {
            console.log('🔄 Скидання стану ticket-manager...');

            // Очищення таймерів
            this._cleanupState();

            // Очищення кешу DOM
            this.domCache.buttons = {};
            this.domCache.participants = {};
            this.domCache.userCoins = null;

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