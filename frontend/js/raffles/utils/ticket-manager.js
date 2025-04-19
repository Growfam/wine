/**
 * WINIX - Система розіграшів (ticket-manager.js)
 * Оптимізований модуль для взаємодії з участю в розіграшах
 * Слугує проксі для основного модулю participation.js
 * Виправлено дублювання логіки управління білетами
 * @version 2.0.0
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше ticket-manager.js');
        return;
    }

    // Модуль управління білетами (тепер як проксі для participation.js)
    const ticketManager = {
        // Час останньої синхронізації
        lastSyncTime: 0,

        // Ініціалізація модуля
        init: function() {
            console.log('🎟️ Ініціалізація модуля управління білетами...');

            // Додавання обробників подій
            this.setupEventListeners();

            // Додавання стилів анімацій
            this.addAnimationStyles();

            // Синхронізація з основним модулем
            this.syncWithParticipation();

            console.log('✅ Модуль управління білетами успішно ініціалізовано');
        },

        /**
         * Додавання стилів анімацій
         */
        addAnimationStyles: function() {
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
            `;

            document.head.appendChild(style);
        },

        /**
         * Синхронізація з основним модулем participation
         */
        syncWithParticipation: function() {
            // Перевіряємо наявність модуля participation
            if (!window.WinixRaffles.participation) {
                console.warn('⚠️ Модуль participation не знайдено. Синхронізація неможлива.');

                // Завантажимо пізніше, коли буде доступний
                setTimeout(() => {
                    if (window.WinixRaffles.participation) {
                        this.syncWithParticipation();
                    }
                }, 1000);

                return;
            }

            // Оновлюємо час останньої синхронізації
            this.lastSyncTime = Date.now();

            console.log('🔄 Успішна синхронізація з модулем participation');

            // Запускаємо оновлення білетів через 2 секунди
            setTimeout(() => {
                this.updateTicketDisplayForAll();
            }, 2000);
        },

        /**
         * Налаштування обробників подій
         */
        setupEventListeners: function() {
            // Обробник події успішної участі в розіграші
            document.addEventListener('raffle-participation', (event) => {
                if (event.detail && event.detail.successful) {
                    this.handleParticipationEvent(event.detail);
                    this.animateCoinsDecrease();
                }
            });

            // Обробник події оновлення даних користувача
            document.addEventListener('user-data-updated', (event) => {
                this.handleUserDataUpdate(event.detail);
            });
        },

        /**
         * Обробка події успішної участі в розіграші
         * @param {Object} data - Дані про участь
         */
        handleParticipationEvent: function(data) {
            if (!data || !data.raffleId) return;

            // Викликаємо оновлення відображення
            setTimeout(() => {
                this.updateTicketDisplay(data.raffleId, data.ticketCount);

                // Оновлюємо лічильник учасників розіграшу
                this.updateParticipantsCount(data.raffleId);
            }, 500);

            console.log(`✅ Оброблено подію успішної участі в розіграші ${data.raffleId}`);
        },

        /**
         * Обробка події оновлення даних користувача
         * @param {Object} data - Дані користувача
         */
        handleUserDataUpdate: function(data) {
            if (!data || !data.userData) return;

            // Перевіряємо, чи дані містять оновлений баланс жетонів
            if (typeof data.userData.coins !== 'undefined') {
                // Оновлюємо відображення жетонів
                this.updateCoinsDisplay(data.userData.coins);
            }
        },

        /**
         * Оновлення відображення балансу жетонів
         * @param {number} coins - Кількість жетонів
         */
        updateCoinsDisplay: function(coins) {
            // Оновлюємо елемент відображення жетонів
            const coinsElement = document.getElementById('user-coins');
            if (coinsElement) {
                coinsElement.textContent = coins;
            }

            // Оновлюємо localStorage
            localStorage.setItem('userCoins', coins.toString());
            localStorage.setItem('winix_coins', coins.toString());
        },

        /**
         * Анімація зменшення кількості жетонів
         */
        animateCoinsDecrease: function() {
            const coinsElement = document.getElementById('user-coins');
            if (coinsElement) {
                // Додаємо клас для анімації зміни
                coinsElement.classList.add('decreasing');

                // Видаляємо клас через секунду
                setTimeout(() => {
                    coinsElement.classList.remove('decreasing');
                }, 1000);
            }
        },

        /**
         * Оновлення відображення кількості білетів для всіх розіграшів
         */
        updateTicketDisplayForAll: function() {
            // Перевіряємо наявність модуля participation
            if (!window.WinixRaffles.participation || !window.WinixRaffles.participation.userRaffleTickets) {
                return;
            }

            const tickets = window.WinixRaffles.participation.userRaffleTickets;

            // Оновлюємо відображення для кожного розіграшу
            for (const raffleId in tickets) {
                this.updateTicketDisplay(raffleId, tickets[raffleId]);
            }
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
        },

        /**
         * Участь у розіграші (делегування до participation.js)
         * @param {string} raffleId - ID розіграшу
         * @param {number} entryCount - Кількість білетів для додавання
         * @returns {Promise<Object>} Результат участі
         */
        participateInRaffle: async function(raffleId, entryCount = 1) {
            // Перевірка наявності модуля participation
            if (!window.WinixRaffles.participation || typeof window.WinixRaffles.participation.participateInRaffle !== 'function') {
                return {
                    success: false,
                    message: 'Модуль участі в розіграшах недоступний'
                };
            }

            try {
                // Делегуємо виклик до основного модуля participation
                const result = await window.WinixRaffles.participation.participateInRaffle(raffleId, entryCount);
                return result;
            } catch (error) {
                console.error('❌ Помилка участі в розіграші:', error);
                return {
                    success: false,
                    message: error.message || 'Помилка участі в розіграші'
                };
            }
        },

        /**
         * Оновлення кількості учасників розіграшу
         * @param {string} raffleId - ID розіграшу
         */
        updateParticipantsCount: function(raffleId) {
            try {
                // Знаходимо елементи з кількістю учасників
                const participantsElements = document.querySelectorAll(
                    `.raffle-card[data-raffle-id="${raffleId}"] .participants-count .count, ` +
                    `.main-raffle[data-raffle-id="${raffleId}"] .participants-info .participants-count, ` +
                    `.main-raffle .participants-info .participants-count`
                );

                participantsElements.forEach(element => {
                    // Отримуємо поточне значення і збільшуємо його
                    const currentCount = parseInt(element.textContent.replace(/\s+/g, '')) || 0;
                    element.textContent = (currentCount + 1).toString()
                        .replace(/\B(?=(\d{3})+(?!\d))/g, " "); // Форматування з пробілами

                    // Додаємо клас для анімації оновлення
                    element.classList.add('updated');

                    // Видаляємо клас через секунду
                    setTimeout(() => {
                        element.classList.remove('updated');
                    }, 1000);
                });
            } catch (e) {
                console.warn("⚠️ Не вдалося оновити лічильник учасників:", e);
            }
        },

        /**
         * Отримання кількості білетів для розіграшу
         * @param {string} raffleId - ID розіграшу
         * @returns {number} Кількість білетів
         */
        getTicketCount: function(raffleId) {
            // Перевірка наявності модуля participation
            if (!window.WinixRaffles.participation || !window.WinixRaffles.participation.userRaffleTickets) {
                return 0;
            }

            return window.WinixRaffles.participation.userRaffleTickets[raffleId] || 0;
        },

        /**
         * Оновлення вартості участі для розіграшу
         * @param {string} raffleId - ID розіграшу
         * @param {number} fee - Вартість участі
         */
        updateEntryFee: function(raffleId, fee) {
            if (!raffleId) return;

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
         * Синхронізація з сервером (делегування до participation.js)
         * @returns {Promise<boolean>} Результат синхронізації
         */
        syncWithServer: async function() {
            // Перевірка наявності модуля participation
            if (!window.WinixRaffles.participation || typeof window.WinixRaffles.participation.syncWithServer !== 'function') {
                console.warn('⚠️ Метод syncWithServer модуля participation недоступний');
                return false;
            }

            try {
                // Делегуємо виклик до основного модуля participation
                const result = await window.WinixRaffles.participation.syncWithServer();

                // Оновлюємо час останньої синхронізації
                if (result) {
                    this.lastSyncTime = Date.now();
                }

                return result;
            } catch (error) {
                console.error('❌ Помилка синхронізації з сервером:', error);
                return false;
            }
        },

        /**
         * Отримання поточного балансу жетонів з DOM
         * @returns {number} Кількість жетонів
         */
        getCurrentCoinsBalance: function() {
            // Перевіряємо елемент в DOM
            const coinsElement = document.getElementById('user-coins');
            if (coinsElement) {
                return parseInt(coinsElement.textContent) || 0;
            }

            // Спробуємо отримати з localStorage
            return parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins')) || 0;
        },

        /**
         * Перевірка достатності жетонів для участі
         * @param {number} requiredCoins - Необхідна кількість жетонів
         * @returns {boolean} Результат перевірки
         */
        hasEnoughCoins: function(requiredCoins) {
            const currentCoins = this.getCurrentCoinsBalance();
            return currentCoins >= requiredCoins;
        },

        /**
         * Показ повідомлення про недостатню кількість жетонів
         * @param {number} requiredCoins - Необхідна кількість жетонів
         */
        showNotEnoughCoinsMessage: function(requiredCoins) {
            const currentCoins = this.getCurrentCoinsBalance();

            // Показуємо повідомлення про недостатню кількість жетонів
            if (typeof window.showToast === 'function') {
                window.showToast(`Недостатньо жетонів для участі. Потрібно ${requiredCoins}, у вас ${currentCoins}.`, 'warning');
            } else {
                alert(`Недостатньо жетонів для участі. Потрібно ${requiredCoins}, у вас ${currentCoins}.`);
            }
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