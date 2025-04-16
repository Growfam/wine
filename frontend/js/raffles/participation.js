/**
 * WINIX - Система розіграшів (participation.js)
 * Модуль для обробки участі користувача в розіграшах
 * Оптимізована версія з виправленням проблем узгодженості даних
 * @version 1.3.1
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше participation.js');
        return;
    }

    // Підмодуль для участі в розіграшах
    const participation = {
        // Множина ID розіграшів, у яких користувач уже бере участь (для відстеження)
        participatingRaffles: new Set(),

        // Кількість білетів користувача для кожного розіграшу
        userRaffleTickets: {},

        // Кеш недійсних розіграшів (для кращої роботи UI)
        invalidRaffleIds: new Set(),

        // Час останньої участі (для запобігання надмірній кількості запитів)
        lastParticipationTime: 0,

        // Стан запиту участі (для запобігання дублікатам)
        requestInProgress: false,

        // Черга запитів для запобігання втраті даних
        pendingRequests: [],

        // Ініціалізація модуля
        init: function() {
            console.log('🎯 Ініціалізація модуля участі в розіграшах...');

            // Створюємо додаткові ресурси для синхронізації станів
            this.setupSyncMechanisms();

            // Завантаження розіграшів користувача
            this.loadUserRaffles();

            // Додаємо обробники подій
            this.setupEventListeners();
        },

        // Налаштування механізмів синхронізації
        setupSyncMechanisms: function() {
            // Обробник для збереження даних перед закриттям сторінки
            window.addEventListener('beforeunload', () => {
                // Зберігаємо стан участі в розіграшах
                try {
                    const participationState = {
                        raffles: Array.from(this.participatingRaffles),
                        tickets: this.userRaffleTickets,
                        lastUpdate: Date.now()
                    };
                    localStorage.setItem('winix_participation_state', JSON.stringify(participationState));
                } catch (e) {
                    console.warn('⚠️ Не вдалося зберегти стан участі:', e);
                }
            });

            // Спроба відновлення даних з localStorage
            try {
                const savedState = localStorage.getItem('winix_participation_state');
                if (savedState) {
                    const parsedState = JSON.parse(savedState);

                    // Перевіряємо чи дані не застарілі (не більше 1 години)
                    if (parsedState && parsedState.lastUpdate &&
                        (Date.now() - parsedState.lastUpdate < 3600000)) {

                        // Відновлюємо множину розіграшів
                        if (Array.isArray(parsedState.raffles)) {
                            this.participatingRaffles = new Set(parsedState.raffles);
                        }

                        // Відновлюємо кількість білетів
                        if (parsedState.tickets) {
                            this.userRaffleTickets = parsedState.tickets;
                        }

                        console.log('✅ Успішно відновлено локальний стан участі');
                    }
                }
            } catch (e) {
                console.warn('⚠️ Помилка відновлення стану участі:', e);
            }
        },

        // Налаштування обробників подій
        setupEventListeners: function() {
            // Обробник для кнопок участі в розіграшах з делегуванням подій
            document.addEventListener('click', (e) => {
                const joinButton = e.target.closest('.join-button, .mini-raffle-button');

                if (joinButton && !joinButton.disabled && !joinButton.classList.contains('processing')) {
                    const raffleId = joinButton.getAttribute('data-raffle-id');

                    if (raffleId) {
                        e.preventDefault();

                        // Додаємо клас для індикації процесу
                        joinButton.classList.add('processing');

                        // Зберігаємо посилання на кнопку для оновлення стану
                        const buttonRef = joinButton;

                        // Визначаємо тип розіграшу
                        const raffleType = joinButton.classList.contains('mini-raffle-button') ? 'daily' : 'main';

                        // Виконуємо запит участі з оновленням кнопки після завершення
                        this.participateInRaffle(raffleId, raffleType)
                            .catch(error => {
                                console.error('❌ Помилка участі в розіграші:', error);
                                window.showToast(error.message || 'Помилка участі в розіграші', 'error');
                            })
                            .finally(() => {
                                // Видаляємо статус обробки з кнопки
                                buttonRef.classList.remove('processing');
                            });
                    }
                }
            });

            // Глобальний обробник для оновлення даних користувача
            document.addEventListener('user-data-updated', (event) => {
                // Перевіряємо наявність даних про жетони
                if (event.detail && typeof event.detail.userData === 'object' &&
                    typeof event.detail.userData.coins !== 'undefined') {

                    // Оновлюємо відображення жетонів
                    const coinsElement = document.getElementById('user-coins');
                    if (coinsElement) {
                        coinsElement.textContent = event.detail.userData.coins;
                    }

                    // Зберігаємо значення в localStorage для запобігання втраті
                    localStorage.setItem('userCoins', event.detail.userData.coins);
                    localStorage.setItem('winix_coins', event.detail.userData.coins);

                    console.log('🔄 Оновлено баланс жетонів:', event.detail.userData.coins);
                }

                // Перевіряємо чи це не подія від нашого модуля
                if (event.source !== 'participation.js') {
                    this.loadUserRaffles();
                }
            });

            // Обробник для переходу між вкладками (для оновлення даних)
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    // Завантажуємо оновлені дані при поверненні на вкладку
                    setTimeout(() => {
                        this.loadUserRaffles();
                    }, 1000);
                }
            });
        },

        // Завантаження розіграшів користувача
        loadUserRaffles: async function() {
            const userId = WinixRaffles.state.telegramId ||
                           (window.WinixAPI ? window.WinixAPI.getUserId() : null);

            if (!userId) {
                console.warn('⚠️ Не вдалося визначити ID користувача для завантаження розіграшів');
                return;
            }

            try {
                // Перед відправкою запиту спочатку показуємо кешовані дані
                this.updateParticipationButtons();

                // Запит до API
                const response = await WinixAPI.apiRequest(`user/${userId}/raffles`, 'GET', null, {
                    suppressErrors: true,
                    hideLoader: true,
                    timeout: 8000 // Збільшуємо таймаут для запобігання помилок
                });

                if (response && response.status === 'success' && Array.isArray(response.data)) {
                    // Очищаємо та заповнюємо множину розіграшів
                    const previousSize = this.participatingRaffles.size;
                    this.participatingRaffles.clear();
                    this.userRaffleTickets = {};

                    // Заповнюємо новими даними
                    response.data.forEach(raffle => {
                        if (raffle.raffle_id) {
                            // Додаємо до множини участі
                            this.participatingRaffles.add(raffle.raffle_id);

                            // Зберігаємо кількість білетів
                            this.userRaffleTickets[raffle.raffle_id] = raffle.entry_count || 1;
                        }
                    });

                    console.log(`✅ Користувач бере участь у ${this.participatingRaffles.size} розіграшах`);

                    // Зберігаємо дані в localStorage для кращої синхронізації
                    this.saveSyncState();

                    // Оновлюємо кнопки участі тільки якщо були зміни
                    if (previousSize !== this.participatingRaffles.size) {
                        this.updateParticipationButtons();
                    }
                } else if (response && response.status === 'error') {
                    console.warn(`⚠️ Помилка завантаження розіграшів: ${response.message}`);

                    // Якщо помилка 429 (занадто багато запитів), чекаємо і повторюємо
                    if (response.message && response.message.includes('занадто багато запитів')) {
                        setTimeout(() => this.loadUserRaffles(), 5000);
                    }
                }
            } catch (error) {
                console.error('❌ Помилка завантаження розіграшів користувача:', error);
            }
        },

        // Збереження стану синхронізації
        saveSyncState: function() {
            try {
                const participationState = {
                    raffles: Array.from(this.participatingRaffles),
                    tickets: this.userRaffleTickets,
                    lastUpdate: Date.now()
                };
                localStorage.setItem('winix_participation_state', JSON.stringify(participationState));
            } catch (e) {
                console.warn('⚠️ Не вдалося зберегти стан участі:', e);
            }
        },

        // Оновлення кнопок участі в розіграшах
        updateParticipationButtons: function() {
            try {
                // Використовуємо селектори для кращої продуктивності
                const buttons = document.querySelectorAll('.join-button, .mini-raffle-button');
                if (!buttons.length) return;

                // Кешуємо результати для уникнення повторних перевірок
                const participatingMap = {};
                const invalidMap = {};

                // Заповнюємо кеш
                buttons.forEach(button => {
                    const raffleId = button.getAttribute('data-raffle-id');
                    if (!raffleId) return;

                    // Пишемо в кеш лише один раз для кожного raffleId
                    if (participatingMap[raffleId] === undefined) {
                        participatingMap[raffleId] = this.participatingRaffles.has(raffleId);
                    }

                    if (invalidMap[raffleId] === undefined) {
                        invalidMap[raffleId] = (this.invalidRaffleIds && this.invalidRaffleIds.has(raffleId)) ||
                                             (WinixRaffles.state.invalidRaffleIds && WinixRaffles.state.invalidRaffleIds.has(raffleId));
                    }
                });

                // Оновлюємо всі кнопки за один прохід
                buttons.forEach(button => {
                    const raffleId = button.getAttribute('data-raffle-id');
                    if (!raffleId) return;

                    // Для розіграшів, у яких користувач бере участь, змінюємо текст кнопки
                    if (participatingMap[raffleId]) {
                        const ticketCount = this.userRaffleTickets ?
                                         (this.userRaffleTickets[raffleId] || 1) : 1;

                        // Оновлюємо текст кнопки лише якщо він не був оновлений раніше
                        if (!button.classList.contains('participating')) {
                            const isMini = button.classList.contains('mini-raffle-button');
                            button.textContent = isMini ?
                                `Додати ще білет (${ticketCount})` :
                                `Додати ще білет (у вас: ${ticketCount})`;

                            // Змінюємо клас, але не додаємо disabled
                            button.classList.add('participating');
                            button.disabled = false;
                        }
                    }

                    // Для невалідних розіграшів
                    if (invalidMap[raffleId] && !button.classList.contains('disabled')) {
                        button.textContent = 'Розіграш завершено';
                        button.classList.add('disabled');
                        button.disabled = true;
                    }
                });
            } catch (error) {
                console.error("❌ Помилка при оновленні кнопок участі:", error);
            }
        },

        /**
         * Участь у розіграші з покращеною обробкою помилок та синхронізацією
         * @param {string} raffleId - ID розіграшу
         * @param {string} raffleType - Тип розіграшу ('main' або 'daily')
         * @returns {Promise<object>} Результат участі
         */
        participateInRaffle: async function(raffleId, raffleType) {
            const userId = WinixRaffles.state.telegramId ||
                           (window.WinixAPI ? window.WinixAPI.getUserId() : null);

            if (!userId) {
                return Promise.reject(new Error('Не вдалося визначити ваш ID'));
            }

            // Перевірка, чи не виконується вже запит участі
            if (this.requestInProgress) {
                return Promise.reject(new Error('Зачекайте завершення попереднього запиту'));
            }

            // Мінімальне обмеження частоти запитів (5 секунд)
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastParticipationTime;
            if (timeSinceLastRequest < 5000) {
                const secondsToWait = Math.ceil((5000 - timeSinceLastRequest) / 1000);
                return Promise.reject(new Error(`Зачекайте ${secondsToWait} секунд перед наступною спробою`));
            }

            // Отримання кількості жетонів до запиту для перевірки зміни
            const initialCoins = parseInt(document.getElementById('user-coins')?.textContent || localStorage.getItem('userCoins') || '0');

            // Позначаємо, що запит розпочато
            this.requestInProgress = true;
            this.lastParticipationTime = now;

            try {
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }

                // Визначення кількості жетонів для участі
                let entryCount = 1;

                // Виконуємо запит на участь з додатковими опціями
                const response = await WinixAPI.apiRequest(`user/${userId}/participate-raffle`, 'POST', {
                    raffle_id: raffleId,
                    entry_count: entryCount
                }, {
                    timeout: 10000, // Збільшений таймаут
                    retries: 1,     // Кількість повторних спроб
                    bypassThrottle: true // Дозволяємо обхід обмеження швидкості
                });

                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                if (response.status === 'success') {
                    // Локально оновлюємо кількість жетонів негайно
                    const newCoinsBalance = response.data?.new_coins_balance !== undefined
                        ? response.data.new_coins_balance
                        : (initialCoins - entryCount);

                    // Оновлюємо DOM
                    const userCoinsElement = document.getElementById('user-coins');
                    if (userCoinsElement) {
                        userCoinsElement.textContent = newCoinsBalance;
                    }

                    // Зберігаємо в localStorage
                    localStorage.setItem('userCoins', newCoinsBalance.toString());
                    localStorage.setItem('winix_coins', newCoinsBalance.toString());

                    // Додаємо розіграш до множини участі
                    this.participatingRaffles.add(raffleId);

                    // Інкрементуємо кількість білетів
                    this.userRaffleTickets[raffleId] = (this.userRaffleTickets[raffleId] || 0) + 1;

                    // Зберігаємо оновлений стан
                    this.saveSyncState();

                    // Оновлюємо кнопки участі відразу
                    this.updateParticipationButtons();

                    // Визначаємо, чи користувач уже бере участь
                    const isAlreadyParticipating = this.userRaffleTickets[raffleId] > 1;

                    // Показуємо повідомлення про успіх
                    let message = isAlreadyParticipating
                        ? `Додано ще один білет! Тепер у вас ${this.userRaffleTickets[raffleId]} білетів`
                        : 'Ви успішно взяли участь у розіграші';

                    // Показуємо повідомлення про бонус, якщо є
                    if (response.data && response.data.bonus_amount) {
                        message += `. Бонус: ${response.data.bonus_amount} ${response.data.bonus_currency || 'WINIX'}`;
                    }

                    if (typeof window.showToast === 'function') {
                        window.showToast(message, 'success');
                    } else {
                        console.log(`✅ ${message}`);
                    }

                    // Відправляємо глобальну подію оновлення даних користувача
                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                        detail: {
                            userData: {
                                coins: newCoinsBalance,
                                participations_count: this.participatingRaffles.size
                            }
                        },
                        source: 'participation.js'
                    }));

                    // Оновлюємо кількість учасників у DOM
                    this.updateParticipantsCount(raffleId);

                    // Завантажуємо оновлені дані користувача (після невеликої затримки)
                    setTimeout(() => {
                        this.loadUserRaffles();
                    }, 2000);

                    return { success: true, data: response.data, message };
                } else {
                    // Обробка спеціальних помилок
                    if (response.message && response.message.includes('занадто багато запитів')) {
                        throw new Error('Забагато запитів. Спробуйте через 30 секунд');
                    } else {
                        throw new Error(response.message || "Помилка участі в розіграші");
                    }
                }
            } catch (error) {
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                console.error('❌ Помилка участі в розіграші:', error);

                // Показуємо користувачу повідомлення про помилку
                const errorMessage = error.message || "Помилка при спробі участі в розіграші";

                if (typeof window.showToast === 'function') {
                    window.showToast(errorMessage, 'error');
                }

                // При помилках 429 (занадто багато запитів) затримуємо наступну спробу
                if (errorMessage.includes('занадто багато запитів') ||
                    errorMessage.includes('429') ||
                    error.status === 429) {
                    this.lastParticipationTime = Date.now(); // Оновлюємо час щоб не дозволяти спроби
                }

                throw error;
            } finally {
                // Знімаємо блокування запиту
                this.requestInProgress = false;
            }
        },

        // Функція для оновлення кількості учасників розіграшу в DOM
        updateParticipantsCount: function(raffleId) {
            try {
                // Знайти елемент для оновлення кількості учасників
                const participantsCountElement = document.querySelector(
                    `.raffle-card[data-raffle-id="${raffleId}"] .participants-count .count, ` +
                    `.main-raffle .participants-info .participants-count`
                );

                if (participantsCountElement) {
                    // Отримати поточне значення і збільшити його
                    const currentCount = parseInt(participantsCountElement.textContent.replace(/\s+/g, '')) || 0;
                    participantsCountElement.textContent = (currentCount + 1).toString()
                        .replace(/\B(?=(\d{3})+(?!\d))/g, " "); // Форматування з пробілами між розрядами
                }
            } catch (e) {
                console.warn("⚠️ Не вдалося оновити лічильник учасників:", e);
            }
        },

        // Очищення списку недійсних розіграшів
        clearInvalidRaffleIds: function() {
            this.invalidRaffleIds.clear();
            console.log('🧹 Очищено список недійсних розіграшів');
        },

        // Додає розіграш до недійсних
        addInvalidRaffleId: function(raffleId) {
            if (!raffleId) return;

            this.invalidRaffleIds.add(raffleId);

            // Також додаємо до глобального списку
            if (WinixRaffles.state.invalidRaffleIds) {
                WinixRaffles.state.invalidRaffleIds.add(raffleId);
            }

            console.log(`⚠️ Додано розіграш ${raffleId} до списку недійсних`);
            this.updateParticipationButtons();
        }
    };

    // Додаємо модуль участі до основного модуля розіграшів
    WinixRaffles.participation = participation;

    // Ініціалізація модуля при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        if (WinixRaffles.state.isInitialized) {
            participation.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                participation.init();
            });
        }
    });
})();