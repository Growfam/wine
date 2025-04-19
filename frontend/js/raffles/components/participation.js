/**
 * WINIX - Система розіграшів (participation.js)
 * Оптимізований модуль для обробки участі користувача в розіграшах
 * Виправлена версія з покращеною обробкою помилок та стабільністю
 * @version 2.0.0
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше participation.js');
        return;
    }

    // Підмодуль для участі в розіграшах
    const participation = {
        // Множина ID розіграшів, у яких користувач уже бере участь (для відстеження)
        participatingRaffles: new Set(),

        // Кількість білетів користувача для кожного розіграшу
        userRaffleTickets: {},

        // Кеш невалідних розіграшів (для кращої роботи UI)
        invalidRaffleIds: new Set(),

        // ВАЖЛИВО: Замість глобального флагу requestInProgress тепер ведемо облік запитів по кожному розіграшу окремо
        activeRequests: new Map(), // Map<raffleId, {timestamp, status}>

        // Час останньої участі (для запобігання надмірній кількості запитів)
        lastParticipationTime: 0,

        // Ідентифікатор для відстеження поточного запиту
        currentRequestId: null,

        // Черга запитів для запобігання втраті даних
        pendingRequests: [],

        // Дані транзакцій для відстеження стану
        transactions: new Map(), // Map<transactionId, {raffleId, status, timestamp}>

        // Таймер для індикації обробки (для кращого UX)
        processingTimers: {},

        // Останнє скидання стану
        lastStateReset: Date.now(),

        // Максимальна кількість жетонів для участі
        MAX_ENTRY_COUNT: 100,

        // Ініціалізація модуля
        init: function() {
            console.log('🎯 Ініціалізація модуля участі в розіграшах...');

            // Примусове скидання стану при завантаженні
            this.lastParticipationTime = 0;
            this.lastStateReset = Date.now();
            this.currentRequestId = null;
            this.activeRequests.clear();
            this.transactions.clear();

            // Перевіряємо збережений стан участі в localStorage
            this._restoreParticipationFromStorage();

            // Перевіряємо незавершені транзакції
            this.checkPendingTransactions();

            // Створюємо додаткові ресурси для синхронізації станів
            this.setupSyncMechanisms();

            // Завантаження розіграшів користувача
            this.loadUserRaffles();

            // Додаємо обробники подій
            this.setupEventListeners();

            // Запускаємо таймер перевірки блокування
            this._startLockingMonitor();
        },

        // Додаємо моніторинг зависання запитів
        _startLockingMonitor: function() {
            setInterval(() => {
                const now = Date.now();

                // Перевіряємо індивідуальні запити для кожного розіграшу
                for (const [raffleId, requestInfo] of this.activeRequests.entries()) {
                    if (now - requestInfo.timestamp > 15000) {
                        console.warn(`⚠️ Виявлено застряглий запит для розіграшу ${raffleId}, автоматичне скидання`);
                        this.activeRequests.delete(raffleId);
                        // Скидаємо стан кнопок для цього розіграшу
                        this._clearPendingParticipationState(raffleId);
                    }
                }

                // Перевіряємо транзакції, які могли застрягти
                for (const [transactionId, transactionInfo] of this.transactions.entries()) {
                    if (transactionInfo.status === 'pending' && now - transactionInfo.timestamp > 30000) {
                        console.warn(`⚠️ Виявлено застряглу транзакцію ${transactionId}, перевіряємо статус`);
                        // Перевіряємо статус транзакції через API
                        this._checkTransactionStatus(transactionId, transactionInfo.raffleId);
                    }
                }
            }, 3000); // Перевіряємо кожні 3 секунди
        },

        // Перевірка статусу транзакції
        _checkTransactionStatus: function(transactionId, raffleId) {
            // Якщо є API для перевірки транзакцій - використовуємо його
            if (window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function') {
                const userId = WinixRaffles.state.telegramId ||
                              (window.WinixAPI.getUserId ? window.WinixAPI.getUserId() : null);

                if (!userId) return;

                // Запит до API для перевірки статусу транзакції
                window.WinixAPI.apiRequest(`user/${userId}/transaction/${transactionId}`, 'GET', null, {
                    suppressErrors: true,
                    hideLoader: true,
                    timeout: 5000
                }).then(response => {
                    if (response && response.status === 'success' && response.data) {
                        const transaction = response.data;

                        // Якщо транзакція успішна - оновлюємо стан
                        if (transaction.status === 'completed') {
                            console.log(`✅ Транзакція ${transactionId} успішно завершена`);
                            // Додаємо до множини розіграшів, у яких бере участь користувач
                            if (raffleId) {
                                this.participatingRaffles.add(raffleId);

                                // Оновлюємо кількість білетів, якщо вона є в даних
                                if (transaction.entry_count) {
                                    this.userRaffleTickets[raffleId] = transaction.entry_count;
                                } else {
                                    // Інакше інкрементуємо поточне значення
                                    this.userRaffleTickets[raffleId] = (this.userRaffleTickets[raffleId] || 0) + 1;
                                }

                                // Оновлюємо кнопки участі
                                this.updateParticipationButtons();

                                // Оновлюємо дані в localStorage
                                this.saveSyncState();
                            }

                            // Видаляємо транзакцію з відстеження
                            this.transactions.delete(transactionId);
                        } else if (transaction.status === 'failed') {
                            console.warn(`⚠️ Транзакція ${transactionId} не вдалася`);
                            // Видаляємо транзакцію з відстеження
                            this.transactions.delete(transactionId);
                        }
                    }
                }).catch(err => {
                    console.error(`❌ Помилка перевірки транзакції ${transactionId}:`, err);
                });
            }
        },

        // Відновлення стану участі з localStorage
        _restoreParticipationFromStorage: function() {
            try {
                const savedState = localStorage.getItem('winix_participation_state');
                if (savedState) {
                    const parsedState = JSON.parse(savedState);

                    // Перевіряємо чи дані не застаріли
                    if (parsedState && parsedState.lastUpdate) {
                        const now = Date.now();
                        // Якщо кеш старіший за 30 хвилин, не використовуємо його
                        if (now - parsedState.lastUpdate < 1800000) {
                            // Відновлюємо множину розіграшів
                            if (Array.isArray(parsedState.raffles)) {
                                this.participatingRaffles = new Set(parsedState.raffles);
                            }

                            // Відновлюємо кількість білетів
                            if (parsedState.tickets) {
                                this.userRaffleTickets = parsedState.tickets;
                            }

                            // Відновлюємо транзакції, якщо вони є
                            if (parsedState.transactions) {
                                this.transactions = new Map(parsedState.transactions);
                            }

                            console.log('✅ Успішно відновлено локальний стан участі');
                        } else {
                            console.log('ℹ️ Кеш участі застарів, очищаємо');
                            localStorage.removeItem('winix_participation_state');
                        }
                    }
                }

                // Також відновлюємо невалідні розіграші
                const invalidRaffles = localStorage.getItem('winix_invalid_raffles');
                if (invalidRaffles) {
                    try {
                        this.invalidRaffleIds = new Set(JSON.parse(invalidRaffles));
                    } catch (e) {
                        console.warn('⚠️ Помилка відновлення невалідних розіграшів:', e);
                    }
                }

                // Відновлюємо незавершені транзакції
                const pendingTransactions = localStorage.getItem('winix_pending_transactions');
                if (pendingTransactions) {
                    try {
                        const transactions = JSON.parse(pendingTransactions);
                        // Фільтруємо транзакції, які не старіші 30 хвилин
                        const now = Date.now();
                        const validTransactions = transactions.filter(t => now - t.timestamp < 1800000);

                        // Додаємо транзакції до відстеження
                        validTransactions.forEach(t => {
                            if (t.raffleId && t.transactionId) {
                                this.transactions.set(t.transactionId, {
                                    raffleId: t.raffleId,
                                    status: 'pending',
                                    timestamp: t.timestamp
                                });
                            }
                        });

                        // Зберігаємо оновлений список
                        if (validTransactions.length !== transactions.length) {
                            localStorage.setItem('winix_pending_transactions', JSON.stringify(validTransactions));
                        }
                    } catch (e) {
                        console.warn('⚠️ Помилка відновлення незавершених транзакцій:', e);
                    }
                }
            } catch (e) {
                console.warn('⚠️ Помилка відновлення стану участі:', e);
            }
        },

        // Налаштування механізмів синхронізації
        setupSyncMechanisms: function() {
            // Обробник для збереження даних перед закриттям сторінки
            window.addEventListener('beforeunload', () => {
                // Зберігаємо стан участі в розіграшах
                this.saveSyncState();

                // Примусове скидання стану запиту при закритті сторінки
                this.activeRequests.clear();
            });

            // Додаємо обробник для скидання зависаючих запитів
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    // Перевіряємо час останнього запиту
                    const now = Date.now();

                    // Перевіряємо, чи є активні запити старші 10 секунд
                    let hasStaleRequests = false;
                    for (const [raffleId, requestInfo] of this.activeRequests.entries()) {
                        if (now - requestInfo.timestamp > 10000) {
                            hasStaleRequests = true;
                            break;
                        }
                    }

                    if (hasStaleRequests) {
                        console.warn('⚠️ Виявлено активні запити після зміни вкладки, скидаємо стан...');
                        this.resetState();
                    }

                    // Завантажуємо оновлені дані при поверненні на вкладку
                    setTimeout(() => {
                        this.loadUserRaffles();
                    }, 1000);
                }
            });

            // Додаємо обробник для очищення invalid state при оновленні сторінки
            window.addEventListener('pageshow', (event) => {
                if (event.persisted) {
                    console.log("📝 Сторінка відновлена з кешу, оновлюємо стан");
                    this.activeRequests.clear();
                    this.lastParticipationTime = 0;
                    this.loadUserRaffles();
                }
            });

            // Додаємо обробник для оновлення стану при зміні балансу
            document.addEventListener('balance-updated', (event) => {
                if (event.detail && event.detail.coins !== undefined) {
                    // Оновлюємо відображення жетонів
                    const coinsElement = document.getElementById('user-coins');
                    if (coinsElement) {
                        coinsElement.textContent = event.detail.coins;
                    }
                }
            });
        },

        // Збереження стану синхронізації в localStorage
        saveSyncState: function() {
            try {
                // Перетворюємо Map в масив для збереження
                const transactionsArray = Array.from(this.transactions.entries());

                const participationState = {
                    raffles: Array.from(this.participatingRaffles),
                    tickets: this.userRaffleTickets,
                    transactions: transactionsArray,
                    lastUpdate: Date.now()
                };
                localStorage.setItem('winix_participation_state', JSON.stringify(participationState));
            } catch (e) {
                console.warn('⚠️ Не вдалося зберегти стан участі:', e);
            }
        },

        // Налаштування обробників подій
        setupEventListeners: function() {
            // Обробник для кнопок участі та деталей розіграшів з делегуванням подій
            document.addEventListener('click', (e) => {
                // Обробка кнопок участі
                const joinButton = e.target.closest('.join-button, .mini-raffle-button');
                if (joinButton && !joinButton.disabled && !joinButton.classList.contains('processing')) {
                    const raffleId = joinButton.getAttribute('data-raffle-id');

                    if (raffleId) {
                        e.preventDefault();

                        // Додаємо клас для індикації процесу і блокуємо кнопку
                        joinButton.classList.add('processing');
                        joinButton.disabled = true;

                        // Зберігаємо посилання на кнопку для оновлення стану
                        const buttonRef = joinButton;

                        // Визначаємо тип розіграшу
                        const raffleType = joinButton.classList.contains('mini-raffle-button') ? 'daily' : 'main';

                        // Виконуємо запит участі з оновленням кнопки після завершення
                        this.participateInRaffle(raffleId, raffleType)
                            .then(result => {
                                // Обробка успішної участі
                                if (result && result.success) {
                                    // Зберігаємо стан участі
                                    this.participatingRaffles.add(raffleId);

                                    // Оновлюємо кількість білетів
                                    const newTicketCount = result.data?.total_entries ||
                                                        (this.userRaffleTickets[raffleId] || 0) + 1;
                                    this.userRaffleTickets[raffleId] = newTicketCount;

                                    // Оновлюємо текст кнопки
                                    const isMini = buttonRef.classList.contains('mini-raffle-button');
                                    buttonRef.textContent = isMini ?
                                        `Додати ще білет (${newTicketCount})` :
                                        `Додати ще білет (у вас: ${newTicketCount})`;

                                    buttonRef.classList.add('participating');

                                    // Оновлюємо баланс жетонів
                                    if (result.data && result.data.new_coins_balance !== undefined) {
                                        const coinsElement = document.getElementById('user-coins');
                                        if (coinsElement) {
                                            coinsElement.textContent = result.data.new_coins_balance;
                                        }

                                        // Зберігаємо баланс в localStorage
                                        localStorage.setItem('userCoins', result.data.new_coins_balance);
                                        localStorage.setItem('winix_coins', result.data.new_coins_balance);
                                    }

                                    // Зберігаємо оновлений стан
                                    this.saveSyncState();

                                    // Відправляємо подію про оновлення даних користувача
                                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                                        detail: {
                                            userData: {
                                                coins: result.data?.new_coins_balance,
                                                participations_count: this.participatingRaffles.size
                                            }
                                        },
                                        source: 'participation.js'
                                    }));

                                    // Оновлюємо відображену кількість учасників розіграшу
                                    this._updateParticipantsCount(raffleId);
                                }
                            })
                            .catch(error => {
                                console.error('❌ Помилка участі в розіграші:', error);

                                // Показуємо повідомлення про помилку
                                if (typeof window.showToast === 'function') {
                                    window.showToast(error.message || 'Помилка участі в розіграші', 'error');
                                }
                            })
                            .finally(() => {
                                // Збільшили затримку для надійності
                                setTimeout(() => {
                                    buttonRef.classList.remove('processing');

                                    // Розблоковуємо кнопку тільки якщо це не був успішний запит
                                    if (!this.participatingRaffles.has(raffleId)) {
                                        buttonRef.disabled = false;
                                    }
                                }, 500);
                            });
                    }
                }

                // Обробка кнопок для перегляду деталей розіграшу
                const detailsButton = e.target.closest('.raffle-details-button');
                if (detailsButton) {
                    const raffleId = detailsButton.getAttribute('data-raffle-id');
                    if (raffleId) {
                        e.preventDefault();
                        this.showRaffleDetails(raffleId);
                    }
                }
            });

            // Глобальний обробник для оновлення даних користувача
            document.addEventListener('user-data-updated', (event) => {
                // Перевіряємо наявність даних про жетони
                if (event.detail && event.detail.userData &&
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
        },

        // Завантаження розіграшів користувача
        loadUserRaffles: async function() {
            // Перевіряємо, чи активний запит завантаження користувачa
            if (this._loadingUserRaffles) {
                console.log('⏳ Завантаження розіграшів користувача вже виконується');
                return;
            }

            this._loadingUserRaffles = true;

            try {
                const userId = WinixRaffles.state.telegramId ||
                              (window.WinixAPI ? window.WinixAPI.getUserId() : null);

                if (!userId) {
                    console.warn('⚠️ Не вдалося визначити ID користувача для завантаження розіграшів');
                    return;
                }

                // Перед відправкою запиту спочатку показуємо кешовані дані
                this.updateParticipationButtons();

                // Додали перевірку на наявність методу apiRequest
                if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
                    console.warn('⚠️ WinixAPI.apiRequest не доступний');
                    this._loadingUserRaffles = false;
                    return;
                }

                // Запит до API
                const response = await WinixAPI.apiRequest(`user/${userId}/raffles`, 'GET', null, {
                    suppressErrors: true,
                    hideLoader: true,
                    timeout: 8000, // Збільшуємо таймаут для запобігання помилок
                    allowParallel: true // Цей запит може виконуватись паралельно з іншими
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
            } finally {
                this._loadingUserRaffles = false;
            }
        },

        // Оновлення кнопок участі в розіграшах
        updateParticipationButtons: function() {
            try {
                // Спочатку перевіряємо дані локального сховища
                try {
                    const savedState = localStorage.getItem('winix_participation_state');
                    if (savedState) {
                        const parsedState = JSON.parse(savedState);

                        // Відновлюємо множину розіграшів, якщо вона порожня
                        if (parsedState && Array.isArray(parsedState.raffles) &&
                            (!this.participatingRaffles || this.participatingRaffles.size === 0)) {

                            this.participatingRaffles = new Set(parsedState.raffles);

                            // Відновлюємо кількість білетів
                            if (parsedState.tickets) {
                                this.userRaffleTickets = parsedState.tickets;
                            }

                            console.log(`✅ Відновлено дані участі для ${this.participatingRaffles.size} розіграшів`);
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Помилка відновлення стану участі:', e);
                }

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

                            // Видаляємо статус обробки
                            button.removeAttribute('data-processing');
                            button.classList.remove('processing');
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

        // Перевірка та обробка незавершених транзакцій
        checkPendingTransactions: function() {
            console.log("🔍 Перевірка незавершених транзакцій...");

            try {
                const transactions = JSON.parse(localStorage.getItem('winix_pending_transactions') || '[]');
                const now = Date.now();

                // Фільтруємо актуальні транзакції (не старші 30 хвилин)
                const pendingTransactions = transactions.filter(
                    t => (now - t.timestamp) < 1800000 && t.status === 'pending'
                );

                // Якщо є невирішені транзакції, оновлюємо UI
                if (pendingTransactions.length > 0) {
                    console.log(`⚠️ Знайдено ${pendingTransactions.length} незавершених транзакцій`);

                    // Активуємо запит на сервер для перевірки стану
                    setTimeout(() => this.loadUserRaffles(true), 1000);

                    // Показуємо повідомлення користувачу
                    if (typeof window.showToast === 'function') {
                        window.showToast("Перевірка стану незавершених транзакцій...", 'info');
                    }

                    // Перевіряємо кожну транзакцію
                    pendingTransactions.forEach(transaction => {
                        if (transaction.transactionId) {
                            this._checkTransactionStatus(transaction.transactionId, transaction.raffleId);
                        }
                    });
                }

                // Очищаємо старі записи в будь-якому випадку
                const validTransactions = transactions.filter(
                    t => (now - t.timestamp) < 1800000
                );

                if (validTransactions.length !== transactions.length) {
                    localStorage.setItem('winix_pending_transactions', JSON.stringify(validTransactions));
                }
            } catch (e) {
                console.warn('⚠️ Помилка перевірки незавершених транзакцій:', e);
            }
        },

        /**
         * Виправлена функція для участі в розіграші з належною обробкою помилок
         * @param {string} raffleId - ID розіграшу
         * @param {string} raffleType - Тип розіграшу ('main' або 'daily')
         * @param {number} entryCount - Кількість білетів (за замовчуванням 1)
         * @returns {Promise<Object>} - Результат операції
         */
        participateInRaffle: async function(raffleId, raffleType, entryCount = 1) {
            const userId = WinixRaffles.state.telegramId ||
                          (window.WinixAPI ? window.WinixAPI.getUserId() : null);

            if (!userId) {
                return Promise.reject(new Error('Не вдалося визначити ваш ID'));
            }

            // Перевірка валідності raffleId
            if (!this.isValidUUID(raffleId)) {
                return Promise.reject(new Error('Невалідний ідентифікатор розіграшу'));
            }

            // Перевірка чи вже є активний запит для цього розіграшу
            if (this.activeRequests.has(raffleId)) {
                const requestInfo = this.activeRequests.get(raffleId);
                const now = Date.now();

                // Якщо запит активний менше 4 секунд - однозначно блокуємо
                if (now - requestInfo.timestamp < 4000) {
                    console.warn(`⚠️ Запит для розіграшу ${raffleId} обробляється, очікуйте`);
                    return {
                        success: false,
                        message: 'Будь ласка, зачекайте завершення попереднього запиту'
                    };
                }

                // Якщо запит "завис" (більше 10 секунд), скидаємо його
                if (now - requestInfo.timestamp > 10000) {
                    console.warn(`⚠️ Скидання застряглого запиту для розіграшу ${raffleId}`);
                    this.activeRequests.delete(raffleId);
                    this._clearPendingParticipationState(raffleId);
                } else {
                    // Інакше просимо зачекати, але повертаємо звичайний об'єкт (не Promise.reject)
                    return {
                        success: false,
                        message: 'Ваш запит вже обробляється. Зачекайте завершення.'
                    };
                }
            }

            // Зменшено обмеження часу між запитами до 1.5 секунди для всіх розіграшів
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastParticipationTime;
            if (timeSinceLastRequest < 1500) {
                console.warn("⚠️ Занадто частий запит, потрібно зачекати");
                return {
                    success: false,
                    message: 'Будь ласка, зачекайте секунду перед наступною спробою'
                };
            }

            // Перевірка невалідних розіграшів
            if (this.invalidRaffleIds && this.invalidRaffleIds.has(raffleId)) {
                console.warn(`⚠️ Спроба участі в невалідному розіграші: ${raffleId}`);
                return {
                    success: false,
                    message: 'Розіграш вже завершено або недоступний'
                };
            }

            // Встановлюємо час запиту
            this.lastParticipationTime = now;

            // Додаємо інформацію про цей конкретний запит
            this.activeRequests.set(raffleId, {
                timestamp: now,
                type: raffleType,
                entryCount: entryCount
            });

            // Запам'ятовуємо ID поточного запиту для ідентифікації
            this.currentRequestId = raffleId + '_' + now;
            const currentRequestId = this.currentRequestId;

            // Додаємо власний таймаут для автоматичного скидання - 12 секунд
            const safetyTimeout = setTimeout(() => {
                if (this.currentRequestId === currentRequestId) {
                    console.warn("⚠️ Виявлено довготривалий запит, автоматично скидаємо стан");
                    this.currentRequestId = null;
                    this.activeRequests.delete(raffleId);
                    this._clearPendingParticipationState(raffleId);
                }
            }, 12000);

            // Додаємо індикатор процесу для UI (через 500мс)
            this.processingTimers[raffleId] = setTimeout(() => {
                const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
                buttons.forEach(button => {
                    if (!button.classList.contains('processing')) {
                        button.classList.add('processing');
                        button.setAttribute('data-original-text', button.textContent);
                        button.textContent = 'Обробка...';
                    }
                });
            }, 500);

            // Генеруємо унікальний ID транзакції
            const transactionId = `${raffleId}_${now}_${Math.floor(Math.random() * 1000000)}`;

            // Отримання початкових даних для аналізу змін
            const initialCoins = parseInt(document.getElementById('user-coins')?.textContent ||
                                      localStorage.getItem('userCoins') || '0');

            // Створюємо запис про поточну транзакцію в localStorage для відновлення при перезавантаженні
            try {
                // Зберігаємо дані про поточну транзакцію
                const pendingTransaction = {
                    raffleId: raffleId,
                    timestamp: now,
                    entryCount: entryCount,
                    initialCoins: initialCoins,
                    status: 'pending',
                    transactionId: transactionId
                };

                // Додаємо до відстеження транзакцій
                this.transactions.set(transactionId, {
                    raffleId: raffleId,
                    status: 'pending',
                    timestamp: now
                });

                // Отримуємо існуючі транзакції або створюємо новий масив
                const existingTransactions = JSON.parse(localStorage.getItem('winix_pending_transactions') || '[]');

                // Очищаємо старі транзакції (старші 1 години)
                const validTransactions = existingTransactions.filter(
                    t => (now - t.timestamp) < 3600000 && t.status === 'pending'
                );

                // Додаємо нову транзакцію
                validTransactions.push(pendingTransaction);

                // Зберігаємо оновлений список
                localStorage.setItem('winix_pending_transactions', JSON.stringify(validTransactions));
            } catch (e) {
                console.warn('⚠️ Помилка збереження даних транзакції:', e);
            }

            try {
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }

                // Визначення кількості жетонів для участі
                entryCount = entryCount || 1;

                // Оновлення стану кнопок перед запитом
                this._updateButtonsForPendingParticipation(raffleId);

                // Перевірка наявності API
                if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
                    throw new Error('API недоступний. Оновіть сторінку і спробуйте знову.');
                }

                // Покращений запит з більшою кількістю опцій і унікальним ідентифікатором
                const response = await WinixAPI.apiRequest(`user/${userId}/participate-raffle`, 'POST', {
                    raffle_id: raffleId,
                    entry_count: entryCount,
                    transaction_ref: transactionId, // Додаємо ID транзакції для відстеження
                    _timestamp: now, // Запобігає кешуванню
                    _request_id: currentRequestId // Унікальний ідентифікатор запиту
                }, {
                    timeout: 15000,           // Таймаут 15 секунд
                    retries: 1,               // Одна повторна спроба
                    bypassThrottle: true,     // Обходимо загальне обмеження швидкості
                    allowParallel: false      // Заборона паралельних запитів
                });

                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                if (response.status === 'success') {
                    // Оновлюємо статус транзакції на 'completed'
                    try {
                        const transactions = JSON.parse(localStorage.getItem('winix_pending_transactions') || '[]');
                        const updatedTransactions = transactions.map(t => {
                            if (t.transactionId === transactionId) {
                                return {...t, status: 'completed'};
                            }
                            return t;
                        });
                        localStorage.setItem('winix_pending_transactions', JSON.stringify(updatedTransactions));

                        // Оновлюємо статус транзакції у відстеженні
                        if (this.transactions.has(transactionId)) {
                            this.transactions.set(transactionId, {
                                ...this.transactions.get(transactionId),
                                status: 'completed'
                            });
                        }
                    } catch (e) {
                        console.warn('⚠️ Помилка оновлення статусу транзакції:', e);
                    }

                    // Безпечне оновлення кількості жетонів
                    const newCoinsBalance = response.data?.new_coins_balance !== undefined
                        ? response.data.new_coins_balance
                        : (initialCoins - entryCount);

                    // Оновлюємо DOM негайно
                    const userCoinsElement = document.getElementById('user-coins');
                    if (userCoinsElement) {
                        userCoinsElement.textContent = newCoinsBalance;
                    }

                    // Встановлюємо час останнього оновлення балансу
                    const balanceUpdateTime = Date.now();

                    // Зберігаємо в localStorage з часом оновлення
                    localStorage.setItem('userCoins', newCoinsBalance.toString());
                    localStorage.setItem('winix_coins', newCoinsBalance.toString());
                    localStorage.setItem('winix_balance_update_time', balanceUpdateTime.toString());

                    // Оновлюємо кількість білетів і стан
                    this.participatingRaffles.add(raffleId);
                    const previousTickets = this.userRaffleTickets[raffleId] || 0;
                    const newTickets = response.data?.total_entries || (previousTickets + 1);
                    this.userRaffleTickets[raffleId] = newTickets;

                    // Зберігаємо оновлений стан у localStorage з часом оновлення
                    this.saveSyncState();

                    // Оновлюємо кнопки участі відразу
                    this.updateParticipationButtons();

                    // Визначаємо повідомлення про успіх
                    const ticketCount = this.userRaffleTickets[raffleId];
                    let message = previousTickets > 0
                        ? `Додано ще один білет! Тепер у вас ${ticketCount} білетів`
                        : 'Ви успішно взяли участь у розіграші';

                    // Показуємо повідомлення
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
                                participations_count: this.participatingRaffles.size,
                                last_update: balanceUpdateTime
                            }
                        },
                        source: 'participation.js'
                    }));

                    // Оновлюємо кількість учасників у DOM
                    this._updateParticipantsCount(raffleId);

                    return { success: true, data: response.data, message };
                } else {
                    // Оновлюємо статус транзакції на 'failed'
                    try {
                        const transactions = JSON.parse(localStorage.getItem('winix_pending_transactions') || '[]');
                        const updatedTransactions = transactions.map(t => {
                            if (t.transactionId === transactionId) {
                                return {...t, status: 'failed', error: response.message};
                            }
                            return t;
                        });
                        localStorage.setItem('winix_pending_transactions', JSON.stringify(updatedTransactions));

                        // Оновлюємо статус транзакції у відстеженні
                        if (this.transactions.has(transactionId)) {
                            this.transactions.set(transactionId, {
                                ...this.transactions.get(transactionId),
                                status: 'failed',
                                error: response.message
                            });
                        }
                    } catch (e) {
                        console.warn('⚠️ Помилка оновлення статусу транзакції:', e);
                    }

                    // Обробка спеціальних помилок
                    if (response.message && response.message.includes('занадто багато запитів')) {
                        return {
                            success: false,
                            message: 'Забагато запитів. Спробуйте через 15 секунд'
                        };
                    } else if (response.message && (response.message.includes('raffle_not_found') ||
                               response.message.includes('завершено'))) {
                        // Додаємо до невалідних
                        this.addInvalidRaffleId(raffleId);
                        return {
                            success: false,
                            message: 'Розіграш не знайдено або вже завершено'
                        };
                    } else {
                        return {
                            success: false,
                            message: response.message || "Помилка участі в розіграші"
                        };
                    }
                }
            } catch (error) {
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                console.error(`❌ Помилка участі в розіграші ${raffleId}:`, error);

                // Оновлюємо статус транзакції на 'failed'
                try {
                    const transactions = JSON.parse(localStorage.getItem('winix_pending_transactions') || '[]');
                    const updatedTransactions = transactions.map(t => {
                        if (t.transactionId === transactionId) {
                            return {...t, status: 'failed', error: error.message || 'Невідома помилка'};
                        }
                        return t;
                    });
                    localStorage.setItem('winix_pending_transactions', JSON.stringify(updatedTransactions));

                    // Оновлюємо статус транзакції у відстеженні
                    if (this.transactions.has(transactionId)) {
                        this.transactions.delete(transactionId);
                    }
                } catch (e) {
                    console.warn('⚠️ Помилка оновлення статусу транзакції:', e);
                }

                // Показуємо повідомлення про помилку
                if (typeof window.showToast === 'function') {
                    window.showToast(error.message || "Помилка при спробі участі в розіграші", 'error');
                }

                // Перевіряємо чи помилка стосується завершеного розіграшу
                if (error.message && (error.message.includes('завершено') ||
                                     error.message.includes('not found') ||
                                     error.message.includes('не знайдено'))) {
                    this.addInvalidRaffleId(raffleId);
                }

                return Promise.reject(error);
            } finally {
                // Видаляємо таймер індикації
                if (this.processingTimers[raffleId]) {
                    clearTimeout(this.processingTimers[raffleId]);
                    delete this.processingTimers[raffleId];
                }

                // Очищаємо таймаут в будь-якому випадку
                clearTimeout(safetyTimeout);

                // Очищаємо інформацію про запит з карти активних запитів
                this.activeRequests.delete(raffleId);

                // Очищаємо ID поточного запиту
                if (this.currentRequestId === currentRequestId) {
                    this.currentRequestId = null;
                }

                // Видаляємо статус очікування з кнопок
                setTimeout(() => {
                    this._clearPendingParticipationState(raffleId);
                }, 300);
            }
        },

        /**
         * Функція для відображення деталей розіграшу
         * Використовує глобальну функцію показу модального вікна
         * @param {string} raffleId - ID розіграшу
         */
        showRaffleDetails: function(raffleId) {
            try {
                // Пошук розіграшу в наших даних
                const raffle = this.raffles ? this.raffles.find(r => r.id === raffleId) : null;

                // Якщо розіграш не знайдено
                if (!raffle) {
                    // Спробуємо знайти в активних розіграшах
                    if (WinixRaffles.active && WinixRaffles.active.raffles) {
                        const activeRaffle = WinixRaffles.active.raffles.find(r => r.id === raffleId);
                        if (activeRaffle) {
                            // Визначаємо чи користувач бере участь у розіграші
                            const isParticipating = this.participatingRaffles &&
                                this.participatingRaffles.has(raffleId);

                            // Отримання кількості білетів користувача
                            const ticketCount = isParticipating && this.userRaffleTickets ?
                                (this.userRaffleTickets[raffleId] || 1) : 0;

                            // Викликаємо глобальну функцію
                            window.showRaffleDetailsModal(activeRaffle, isParticipating, ticketCount);
                            return;
                        }
                    }

                    window.showToast('Не вдалося знайти деталі розіграшу', 'error');
                    return;
                }

                // Визначаємо чи користувач бере участь у розіграші
                const isParticipating = this.participatingRaffles &&
                    this.participatingRaffles.has(raffleId);

                // Отримання кількості білетів користувача
                const ticketCount = isParticipating && this.userRaffleTickets ?
                    (this.userRaffleTickets[raffleId] || 1) : 0;

                // Викликаємо глобальну функцію
                window.showRaffleDetailsModal(raffle, isParticipating, ticketCount);
            } catch (error) {
                console.error('❌ Помилка відображення деталей розіграшу:', error);
                window.showToast('Помилка відображення деталей розіграшу', 'error');
            }
        },

        // Очищення списку недійсних розіграшів
        clearInvalidRaffleIds: function() {
            this.invalidRaffleIds.clear();
            console.log('🧹 Очищено список недійсних розіграшів');

            // Також очищаємо локальне сховище
            try {
                localStorage.removeItem('winix_invalid_raffles');
            } catch (e) {
                console.warn('⚠️ Не вдалося очистити кеш невалідних розіграшів:', e);
            }
        },

        // Додає розіграш до недійсних
        addInvalidRaffleId: function(raffleId) {
            if (!raffleId) return;

            this.invalidRaffleIds.add(raffleId);

            // Також додаємо до глобального списку
            if (WinixRaffles.state.invalidRaffleIds) {
                WinixRaffles.state.invalidRaffleIds.add(raffleId);
            }

            // Зберігаємо в localStorage
            try {
                localStorage.setItem('winix_invalid_raffles', JSON.stringify(Array.from(this.invalidRaffleIds)));
            } catch (e) {
                console.warn('⚠️ Не вдалося зберегти невалідні розіграші:', e);
            }

            console.log(`⚠️ Додано розіграш ${raffleId} до списку недійсних`);
            this.updateParticipationButtons();
        },

        /**
         * Перевірка валідності UUID
         * @param {string} id - UUID для перевірки
         * @returns {boolean} Чи валідний UUID
         */
        isValidUUID: function(id) {
            // Спочатку перевіряємо наявність UUID валідатора у WinixRaffles
            if (WinixRaffles.validators && typeof WinixRaffles.validators.isValidUUID === 'function') {
                return WinixRaffles.validators.isValidUUID(id);
            }

            // Потім перевіряємо валідатор у WinixAPI
            if (window.WinixAPI && typeof window.WinixAPI.isValidUUID === 'function') {
                return window.WinixAPI.isValidUUID(id);
            }

            // Запасний валідатор, якщо інші недоступні
            if (!id || typeof id !== 'string') return false;
            const fullUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return fullUUIDRegex.test(id);
        },

        /**
         * Оновлення стану кнопок під час очікування
         * @param {string} raffleId - ID розіграшу
         */
        _updateButtonsForPendingParticipation: function(raffleId) {
            try {
                const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
                buttons.forEach(button => {
                    button.setAttribute('data-processing', 'true');
                    button.classList.add('processing');
                    const originalText = button.textContent;
                    button.setAttribute('data-original-text', originalText);
                    button.textContent = 'Обробка...';
                });
            } catch (e) {
                console.warn('Не вдалося оновити стан кнопок:', e);
            }
        },

        /**
         * Очищення стану очікування
         * @param {string} raffleId - ID розіграшу
         */
        _clearPendingParticipationState: function(raffleId) {
            try {
                const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
                buttons.forEach(button => {
                    button.removeAttribute('data-processing');
                    button.classList.remove('processing');

                    // Відновлюємо оригінальний текст, якщо кнопка не показує участь
                    if (!button.classList.contains('participating')) {
                        const originalText = button.getAttribute('data-original-text');
                        if (originalText) {
                            button.textContent = originalText;
                        }
                        button.disabled = false;
                    }
                });
            } catch (e) {
                console.warn('Не вдалося очистити стан кнопок:', e);
            }
        },

        /**
         * Оновлення кількості учасників розіграшу в DOM
         * @param {string} raffleId - ID розіграшу
         */
        _updateParticipantsCount: function(raffleId) {
            try {
                // Знаходимо елемент для оновлення кількості учасників
                const participantsCountElement = document.querySelector(
                    `.raffle-card[data-raffle-id="${raffleId}"] .participants-count .count, ` +
                    `.main-raffle .participants-info .participants-count`
                );

                if (participantsCountElement) {
                    // Отримуємо поточне значення і збільшуємо його
                    const currentCount = parseInt(participantsCountElement.textContent.replace(/\s+/g, '')) || 0;
                    participantsCountElement.textContent = (currentCount + 1).toString()
                        .replace(/\B(?=(\d{3})+(?!\d))/g, " "); // Форматування з пробілами між розрядами
                }
            } catch (e) {
                console.warn("⚠️ Не вдалося оновити лічильник учасників:", e);
            }
        },

        /**
         * Аварійне скидання стану
         */
        resetState: function() {
            console.log('🔄 Виконується скидання стану participation...');

            // Скидаємо всі прапорці
            this.lastParticipationTime = 0;
            this.lastStateReset = Date.now();
            this.currentRequestId = null;

            // Очищаємо всі активні запити
            this.activeRequests.clear();

            // Очищаємо чергу запитів
            this.pendingRequests = [];

            // Видаляємо таймери індикації
            for (const raffleId in this.processingTimers) {
                clearTimeout(this.processingTimers[raffleId]);
            }
            this.processingTimers = {};

            // Видаляємо статус обробки з усіх кнопок
            try {
                const buttons = document.querySelectorAll('.join-button.processing, .mini-raffle-button.processing');
                buttons.forEach(button => {
                    button.removeAttribute('data-processing');
                    button.classList.remove('processing');
                    button.disabled = false;

                    // Відновлюємо оригінальний текст
                    const originalText = button.getAttribute('data-original-text');
                    if (originalText && !button.classList.contains('participating')) {
                        button.textContent = originalText;
                    }
                });
            } catch (e) {
                console.warn('Не вдалося скинути стан кнопок:', e);
            }

            // Перевіряємо всі незавершені транзакції
            this.checkPendingTransactions();

            console.log('✅ Стан модуля участі успішно скинуто');
            return true;
        }
    };

    // Додаємо модуль участі до основного модуля розіграшів
    WinixRaffles.participation = participation;

    // Ініціалізація модуля при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        // Скидаємо стан запиту при завантаженні сторінки
        if (window.WinixRaffles && window.WinixRaffles.participation) {
            window.WinixRaffles.participation.lastParticipationTime = 0;
            window.WinixRaffles.participation.activeRequests.clear();
        }

        if (WinixRaffles.state.isInitialized) {
            participation.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                participation.init();
            });
        }
    });

    // Додали глобальний обробник для вікна, щоб обробляти помилки та скидати стан
    window.addEventListener('error', function(event) {
        console.error('🚨 Глобальна помилка в participation:', event.error);
        if (participation && participation.activeRequests.size > 0) {
            console.warn('⚠️ Виявлено активні запити під час помилки. Скидаємо стан...');
            participation.resetState();
        }

        // Якщо є індикатор завантаження, ховаємо його
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }
    });

    // Додали обробник необроблених помилок
    window.addEventListener('unhandledrejection', function(event) {
        if (participation && participation.activeRequests.size > 0) {
            console.warn('⚠️ Виявлено необроблену Promise помилку при участі, скидаємо стан...');
            participation.resetState();
        }
    });

    console.log('✅ Модуль участі успішно ініціалізовано');
})();