/**
 * WINIX - Система розіграшів (participation.js)
 * Оптимізований та виправлений модуль для обробки участі користувача в розіграшах
 * Виправлено проблеми з умовами гонки, списанням жетонів та обробкою помилок
 * @version 3.3.0
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
        // СТРОГО КОНТРОЛЬОВАНИЙ РЕЖИМ УЧАСТІ
        safeModeEnabled: true, // Увімкнення безпечного режиму участі
        requestLock: false, // Глобальне блокування всіх запитів участі
        totalRequestCount: 0, // Лічильник усіх запитів
        pendingRequests: {}, // Запити в очікуванні за raffleId
        serverSyncInterval: null, // Інтервал синхронізації з сервером
        lastServerState: {}, // Останній відомий стан сервера
        localOperations: [], // Список локальних операцій для відстежування

        // Множина ID розіграшів, у яких користувач уже бере участь
        participatingRaffles: new Set(),

        // Кількість білетів користувача для кожного розіграшу
        userRaffleTickets: {},

        // Останній відомий баланс жетонів з сервера
        lastKnownBalance: null,
        lastBalanceUpdateTime: 0,

        // Кеш невалідних розіграшів (для кращої роботи UI)
        invalidRaffleIds: new Set(),

        // Карта активних запитів для кожного розіграшу з унікальними ID транзакцій
        activeTransactions: new Map(),

        // Часові мітки останніх запитів для кожного розіграшу
        lastRequestTimes: {},

        // Журнал транзакцій для відслідковування та діагностики
        transactionLog: [],

        // Максимальна кількість записів у журналі
        maxLogSize: 50,

        // Максимальна кількість жетонів для участі
        MAX_ENTRY_COUNT: 100,

        // Мінімальний інтервал між запитами (мс)
        MIN_REQUEST_INTERVAL: 2000,

        // Таймаут для виявлення "зависаючих" запитів (мс)
        REQUEST_TIMEOUT: 15000,

        // Стан обробника моніторингу транзакцій
        transactionMonitorActive: false,

        // Час останнього оновлення синхронізації
        lastSyncTime: 0,

        // Лічильник для дебагу проблем синхронізації
        syncCounter: 0,

        // Таймер для відкладеної синхронізації
        syncTimer: null,

        // Прапорець для запобігання повторним синхронізаціям
        isSyncInProgress: false,

        // Ініціалізація модуля
        init: function() {
            console.log('🎯 Ініціалізація модуля участі в розіграшах...');

            // Очищення стану перед ініціалізацією
            this._cleanupState();

            // Відновлення даних про участь з localStorage
            this._restoreParticipationFromStorage();

            // Запуск моніторингу стану транзакцій
            this._startTransactionMonitor();

            // Перевірка незавершених транзакцій
            this._checkPendingTransactions();

            // Налаштування механізмів синхронізації даних
            this._setupSyncMechanisms();

            // Завантаження даних про участь користувача
            this.loadUserRaffles(true);

            // Додавання обробників подій
            this._setupEventListeners();

            // Синхронізація з локальною базою даних
            this._syncWithIndexedDB();

            console.log('✅ Модуль участі в розіграшах успішно ініціалізовано');

            // Запускаємо періодичну перевірку стану участі
            if (!this.serverSyncInterval) {
                this.serverSyncInterval = setInterval(() => {
                    // Перевіряємо та виправляємо стан участі кожні 5 хвилин
                    if (document.visibilityState === 'visible') {
                        this.verifyAndFixParticipationState()
                            .catch(e => console.warn('Помилка перевірки стану:', e));
                    }
                }, 5 * 60 * 1000); // 5 хвилин

                console.log('🔄 Запущено періодичну перевірку та виправлення стану участі');
            }

            // Одразу запускаємо синхронізацію балансу
            this._getServerBalance();
        },

        /**
         * Очищення стану перед ініціалізацією
         * @private
         */
        _cleanupState: function() {
            // Очищення активних транзакцій
            this.activeTransactions.clear();

            // Скидання таймеру синхронізації
            if (this.syncTimer) {
                clearTimeout(this.syncTimer);
                this.syncTimer = null;
            }

            // Скидання прапорця синхронізації
            this.isSyncInProgress = false;

            // Скидання глобального блокування
            this.requestLock = false;

            // Очищення старих записів незавершених транзакцій у localStorage
            try {
                const pendingTransactions = JSON.parse(localStorage.getItem('winix_pending_transactions') || '[]');
                if (Array.isArray(pendingTransactions) && pendingTransactions.length > 0) {
                    const now = Date.now();
                    // Залишаємо тільки нещодавні (не старші 10 хвилин)
                    const recentTransactions = pendingTransactions.filter(
                        t => (now - t.timestamp < 10 * 60 * 1000)
                    );
                    localStorage.setItem('winix_pending_transactions', JSON.stringify(recentTransactions));
                }
            } catch (e) {
                console.warn('⚠️ Помилка очищення незавершених транзакцій:', e);
                // Якщо помилка, просто очищаємо весь список
                localStorage.removeItem('winix_pending_transactions');
            }

            // Покращуємо очищення кнопок, які могли залишитися в стані "processing"
            document.querySelectorAll('.join-button.processing, .mini-raffle-button.processing').forEach(button => {
                button.classList.remove('processing');
                button.disabled = false;

                // Відновлюємо оригінальний текст
                const originalText = button.getAttribute('data-original-text');
                if (originalText) {
                    button.textContent = originalText;
                } else {
                    const entryFee = button.getAttribute('data-entry-fee') || '1';
                    const isMini = button.classList.contains('mini-raffle-button');
                    button.textContent = isMini ?
                        'Взяти участь' :
                        `Взяти участь за ${entryFee} жетон${parseInt(entryFee) > 1 ? 'и' : ''}`;
                }
            });
        },

        /**
         * Запуск моніторингу транзакцій для виявлення "зависаючих" запитів
         * @private
         */
        _startTransactionMonitor: function() {
            if (this.transactionMonitorActive) return;

            // Функція перевірки стану транзакцій
            const checkTransactions = () => {
                const now = Date.now();

                // Перевірка всіх активних транзакцій
                for (const [raffleId, transaction] of this.activeTransactions.entries()) {
                    const elapsed = now - transaction.timestamp;

                    // Якщо транзакція виконується більше заданого часу, вважаємо її "зависаючою"
                    if (elapsed > this.REQUEST_TIMEOUT) {
                        console.warn(`⚠️ Виявлено "зависаючу" транзакцію для розіграшу ${raffleId}. Скидаємо стан.`);

                        // Логуємо деталі транзакції для діагностики
                        this._logTransaction({
                            type: 'timeout',
                            raffleId: raffleId,
                            transactionId: transaction.id,
                            elapsed: elapsed,
                            timestamp: now
                        });

                        // Видаляємо транзакцію з активних
                        this.activeTransactions.delete(raffleId);

                        // Скидаємо стан кнопок для цього розіграшу
                        this._resetButtonState(raffleId);

                        // Ініціюємо примусову синхронізацію з сервером
                        this._scheduleForcedSync();
                    }
                }

                // Перевірка блокування запитів (глобального)
                if (this.requestLock) {
                    console.warn('⚠️ Виявлено активне глобальне блокування. Перевіряємо наявність активних запитів...');

                    // Якщо немає активних запитів, знімаємо блокування
                    if (Object.keys(this.pendingRequests).length === 0 && this.activeTransactions.size === 0) {
                        console.log('🔓 Знімаємо глобальне блокування, активних запитів немає');
                        this.requestLock = false;
                    }
                }
            };

            // Запускаємо періодичну перевірку кожні 5 секунд
            setInterval(checkTransactions, 5000);
            this.transactionMonitorActive = true;
        },

        /**
         * Перевірка наявності незавершених транзакцій
         * @private
         */
        _checkPendingTransactions: function() {
            try {
                // Отримуємо незавершені транзакції з localStorage
                const pendingTransactions = JSON.parse(localStorage.getItem('winix_pending_transactions') || '[]');

                if (!Array.isArray(pendingTransactions) || pendingTransactions.length === 0) {
                    return;
                }

                console.log(`🔍 Виявлено ${pendingTransactions.length} незавершених транзакцій`);

                // Фільтруємо лише недавні транзакції (не старші 30 хвилин)
                const now = Date.now();
                const recentTransactions = pendingTransactions.filter(
                    t => t.status === 'pending' && (now - t.timestamp < 30 * 60 * 1000)
                );

                if (recentTransactions.length > 0) {
                    console.log(`⚠️ Наявні ${recentTransactions.length} нещодавніх незавершених транзакцій`);

                    // Запускаємо перевірку стану участі
                    setTimeout(() => {
                        this.loadUserRaffles(true);

                        // Друга перевірка через 3 секунди
                        setTimeout(() => {
                            this.loadUserRaffles(true);
                        }, 3000);
                    }, 1000);

                    // Показуємо користувачу повідомлення
                    if (typeof window.showToast === 'function') {
                        window.showToast('Перевірка стану незавершених операцій...', 'info');
                    }
                }

                // Оновлюємо список транзакцій (видаляємо старі)
                const validTransactions = pendingTransactions.filter(
                    t => (now - t.timestamp < 30 * 60 * 1000)
                );

                localStorage.setItem('winix_pending_transactions', JSON.stringify(validTransactions));
            } catch (error) {
                console.error('❌ Помилка перевірки незавершених транзакцій:', error);

                // При помилці очищаємо список транзакцій
                localStorage.removeItem('winix_pending_transactions');
            }
        },

        /**
         * Налаштування механізмів синхронізації
         * @private
         */
        _setupSyncMechanisms: function() {
            // Збереження даних перед закриттям сторінки
            window.addEventListener('beforeunload', () => {
                this._saveParticipationToStorage();
            });

            // Скидання зависаючих запитів при зміні видимості сторінки
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    // При активації сторінки перевіряємо наявність зависаючих запитів
                    const now = Date.now();
                    let hasStaleRequests = false;

                    for (const [raffleId, transaction] of this.activeTransactions.entries()) {
                        if (now - transaction.timestamp > 10000) {
                            hasStaleRequests = true;
                            this.activeTransactions.delete(raffleId);
                            this._resetButtonState(raffleId);
                        }
                    }

                    if (hasStaleRequests) {
                        console.warn('⚠️ Виявлено зависаючі запити після повернення на сторінку');

                        // Примусова синхронізація при виявленні зависаючих запитів
                        this._scheduleForcedSync();
                    }

                    // Перевіряємо, коли останній раз оновлювались дані
                    if (now - this.lastSyncTime > 30000) { // 30 секунд
                        // Якщо давно не оновлювали, завантажуємо свіжі дані
                        setTimeout(() => {
                            this.loadUserRaffles(true);
                            this.lastSyncTime = now;

                            // Також оновлюємо баланс при поверненні на сторінку
                            this._getServerBalance();
                        }, 1000);
                    }
                }
            });

            // Додаємо обробник для відновлення з кешу при перезавантаженні сторінки
            window.addEventListener('pageshow', (event) => {
                if (event.persisted) {
                    console.log("📝 Сторінка відновлена з кешу, оновлюємо стан");
                    this.activeTransactions.clear();
                    this.requestLock = false;

                    // Примусова синхронізація при відновленні з кешу
                    setTimeout(() => {
                        this.loadUserRaffles(true);

                        // Також оновлюємо баланс при відновленні сторінки
                        this._getServerBalance();
                    }, 500);
                }
            });

            // Додано періодичне оновлення даних про участь
            // Це важливо для багатьох користувачів, які тримають вкладку відкритою довгий час
            setInterval(() => {
                if (document.visibilityState === 'visible' && !this.isSyncInProgress) {
                    const now = Date.now();
                    if (now - this.lastSyncTime > 5 * 60 * 1000) { // 5 хвилин
                        console.log('🔄 Періодичне оновлення даних участі');
                        this.loadUserRaffles(true);

                        // Також оновлюємо баланс при періодичному оновленні
                        this._getServerBalance();
                    }
                }
            }, 5 * 60 * 1000); // Перевірка кожні 5 хвилин

            // Додаємо обробник події оновлення балансу
            document.addEventListener('balance-updated', (event) => {
                if (event.detail && typeof event.detail.newBalance === 'number' && event.detail.source !== 'participation.js') {
                    // Запам'ятовуємо новий баланс
                    this.lastKnownBalance = event.detail.newBalance;
                    this.lastBalanceUpdateTime = Date.now();

                    console.log(`📊 Отримано оновлення балансу: ${this.lastKnownBalance} жетонів (джерело: ${event.detail.source})`);
                }
            });
        },

        /**
         * Отримання поточного балансу з сервера
         * @private
         */
        _getServerBalance: async function() {
            try {
                // Пропускаємо, якщо синхронізація вже виконується
                if (this.isSyncInProgress) return;

                console.log("🔄 Запит актуального балансу з сервера...");

                if (window.WinixAPI && typeof window.WinixAPI.getBalance === 'function') {
                    const response = await window.WinixAPI.getBalance();

                    if (response && response.status === 'success' && response.data) {
                        const newBalance = response.data.coins;
                        const oldBalance = parseInt(localStorage.getItem('userCoins')) || 0;

                        // Запам'ятовуємо баланс від сервера
                        this.lastKnownBalance = newBalance;
                        this.lastBalanceUpdateTime = Date.now();

                        console.log(`📊 Отримано баланс з сервера: ${newBalance} жетонів`);

                        // Якщо баланс змінився, оновлюємо локальні дані
                        if (newBalance !== oldBalance) {
                            console.log(`📊 Виявлено розбіжність балансу: локально ${oldBalance}, на сервері ${newBalance}`);

                            // Оновлюємо відображення
                            const userCoinsElement = document.getElementById('user-coins');
                            if (userCoinsElement) {
                                // Додаємо анімацію в залежності від зміни
                                if (newBalance < oldBalance) {
                                    userCoinsElement.classList.add('decreasing');
                                    setTimeout(() => {
                                        userCoinsElement.classList.remove('decreasing');
                                    }, 1000);
                                } else if (newBalance > oldBalance) {
                                    userCoinsElement.classList.add('increasing');
                                    setTimeout(() => {
                                        userCoinsElement.classList.remove('increasing');
                                    }, 1000);
                                }

                                userCoinsElement.textContent = newBalance;
                            }

                            // Оновлюємо локальне сховище
                            localStorage.setItem('userCoins', newBalance.toString());
                            localStorage.setItem('winix_coins', newBalance.toString());
                            localStorage.setItem('winix_balance_update_time', Date.now().toString());

                            // Генеруємо подію для інших модулів
                            document.dispatchEvent(new CustomEvent('balance-updated', {
                                detail: {
                                    oldBalance: oldBalance,
                                    newBalance: newBalance,
                                    source: 'participation.js'
                                }
                            }));
                        }
                    }
                }
            } catch (error) {
                console.warn('⚠️ Помилка отримання балансу з сервера:', error);
            }
        },

        /**
         * Планування примусової синхронізації з сервером
         * Використовується для усунення розбіжностей між локальним станом і сервером
         * @private
         */
        _scheduleForcedSync: function() {
            // Якщо синхронізація вже запланована, не плануємо ще одну
            if (this.syncTimer) {
                return;
            }

            // Скасовуємо наявний таймер, якщо є
            if (this.syncTimer) {
                clearTimeout(this.syncTimer);
            }

            // Встановлюємо новий таймер з невеликою затримкою
            this.syncTimer = setTimeout(() => {
                this.syncTimer = null;

                // Якщо синхронізація вже виконується, не починаємо нову
                if (this.isSyncInProgress) {
                    return;
                }

                console.log('🔄 Виконуємо примусову синхронізацію з сервером');
                this.syncWithServer()
                    .then(() => {
                        console.log('✅ Примусова синхронізація завершена');
                    })
                    .catch(err => {
                        console.error('❌ Помилка примусової синхронізації:', err);
                    });
            }, 1500);
        },

        /**
         * Відновлення даних про участь з localStorage
         * @private
         */
        _restoreParticipationFromStorage: function() {
            try {
                // Відновлення даних участі
                const savedState = localStorage.getItem('winix_participation_state');
                if (savedState) {
                    const parsedState = JSON.parse(savedState);

                    // Перевірка актуальності даних (не старіші 30 хвилин)
                    if (parsedState && parsedState.lastUpdate) {
                        const now = Date.now();
                        const cacheAge = now - parsedState.lastUpdate;

                        if (cacheAge < 30 * 60 * 1000) {
                            // Відновлюємо список розіграшів з участю
                            if (Array.isArray(parsedState.raffles)) {
                                this.participatingRaffles = new Set(parsedState.raffles);
                            }

                            // Відновлюємо кількість білетів
                            if (parsedState.tickets) {
                                this.userRaffleTickets = parsedState.tickets;
                            }

                            console.log('✅ Успішно відновлено дані про участь із локального сховища');
                        } else {
                            console.log('ℹ️ Кеш участі застарів, виконується очищення');
                            localStorage.removeItem('winix_participation_state');
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
        },

        /**
         * Збереження даних про участь у localStorage
         * @private
         */
        _saveParticipationToStorage: function() {
            try {
                const participationState = {
                    raffles: Array.from(this.participatingRaffles),
                    tickets: this.userRaffleTickets,
                    lastUpdate: Date.now()
                };

                localStorage.setItem('winix_participation_state', JSON.stringify(participationState));

                // Збереження списку недійсних розіграшів
                localStorage.setItem('winix_invalid_raffles', JSON.stringify(Array.from(this.invalidRaffleIds)));
            } catch (error) {
                console.warn('⚠️ Помилка збереження даних про участь:', error);
            }
        },

        /**
         * Синхронізація даних з IndexedDB для додаткової надійності
         * @private
         */
        _syncWithIndexedDB: function() {
            // Цей метод можна розширити для додаткового зберігання даних у IndexedDB
            // Це забезпечить більшу надійність порівняно з localStorage
            try {
                if (!window.indexedDB) {
                    // IndexedDB не підтримується, нічого не робимо
                    return;
                }

                // Базова інтеграція з IndexedDB може бути додана тут
                // ...
            } catch (error) {
                // Ігноруємо помилки, це не критична функціональність
                console.warn('⚠️ Не вдалося синхронізувати дані з IndexedDB:', error);
            }
        },

        /**
         * Налаштування обробників подій
         * @private
         */
        _setupEventListeners: function() {
            // Обробник кліків на кнопки участі (з використанням делегування подій)
            document.addEventListener('click', (event) => {
                // Знаходимо ближчу кнопку участі
                const participateButton = event.target.closest('.join-button, .mini-raffle-button');

                // Перевіряємо, що це кнопка участі та вона не заблокована
                if (participateButton && !participateButton.disabled && !participateButton.classList.contains('processing')) {
                    const raffleId = participateButton.getAttribute('data-raffle-id');

                    if (!raffleId) return;

                    event.preventDefault();

                    // Перевірка на часті кліки
                    const now = Date.now();
                    const lastRequestTime = this.lastRequestTimes[raffleId] || 0;
                    if (now - lastRequestTime < this.MIN_REQUEST_INTERVAL) {
                        if (typeof window.showToast === 'function') {
                            window.showToast('Будь ласка, зачекайте перед наступною спробою', 'info');
                        }
                        return;
                    }

                    // Перевірка глобального блокування
                    if (this.requestLock) {
                        if (typeof window.showToast === 'function') {
                            window.showToast('Система тимчасово недоступна, спробуйте за кілька секунд', 'warning');
                        }
                        return;
                    }

                    // Визначаємо тип розіграшу
                    const raffleType = participateButton.classList.contains('mini-raffle-button') ? 'daily' : 'main';

                    // Встановлюємо стан кнопки
                    participateButton.classList.add('processing');
                    participateButton.disabled = true;

                    // Зберігаємо оригінальний текст кнопки, якщо його немає
                    if (!participateButton.getAttribute('data-original-text')) {
                        participateButton.setAttribute('data-original-text', participateButton.textContent);
                    }

                    // Змінюємо текст на "Обробка..."
                    participateButton.textContent = 'Обробка...';

                    // Запускаємо участь у розіграші
                    this.participateInRaffle(raffleId, raffleType)
                        .then(result => {
                            if (result.success) {
                                // Кнопка буде оновлена через updateParticipationButtons
                                console.log(`✅ Успішна участь у розіграші ${raffleId}`);
                            } else {
                                // У разі помилки відновлюємо стан кнопки
                                this._resetButtonState(raffleId);

                                // Показуємо повідомлення про помилку
                                if (typeof window.showToast === 'function') {
                                    window.showToast(result.message, 'warning');
                                }
                            }
                        })
                        .catch(error => {
                            console.error('❌ Помилка участі в розіграші:', error);

                            // Відновлюємо стан кнопки
                            this._resetButtonState(raffleId);

                            // Показуємо повідомлення про помилку
                            if (typeof window.showToast === 'function') {
                                window.showToast(error.message || 'Помилка при спробі участі в розіграші', 'error');
                            }
                        });
                }
            });

            // Обробник оновлення даних користувача
            document.addEventListener('user-data-updated', (event) => {
                // Перевіряємо, чи це не наша власна подія
                if (event.source === 'participation.js') return;

                // Перевіряємо наявність даних про жетони
                if (event.detail && event.detail.userData &&
                    typeof event.detail.userData.coins !== 'undefined') {

                    // Оновлюємо відображення жетонів
                    const coinsElement = document.getElementById('user-coins');
                    if (coinsElement) {
                        coinsElement.textContent = event.detail.userData.coins;
                    }

                    // Оновлюємо кеш
                    localStorage.setItem('userCoins', event.detail.userData.coins);
                    localStorage.setItem('winix_coins', event.detail.userData.coins);

                    // Запам'ятовуємо останнє відоме значення балансу
                    this.lastKnownBalance = event.detail.userData.coins;
                    this.lastBalanceUpdateTime = Date.now();
                }

                // Оновлюємо список розіграшів з участю користувача
                setTimeout(() => {
                    this.loadUserRaffles(true);
                }, 500);
            });

            // Додаємо обробник для події raffle-participation
            document.addEventListener('raffle-participation', (event) => {
                if (event.detail && event.detail.successful && event.detail.raffleId) {
                    // Встановлюємо прапорець активної участі для цього розіграшу
                    this.participatingRaffles.add(event.detail.raffleId);

                    // Оновлюємо кількість білетів
                    if (event.detail.ticketCount) {
                        this.userRaffleTickets[event.detail.raffleId] = event.detail.ticketCount;

                        // Зберігаємо в localStorage
                        this._saveParticipationToStorage();

                        // Оновлюємо кнопки участі
                        this.updateParticipationButtons();
                    }

                    // Планування додаткової синхронізації для перевірки
                    setTimeout(() => {
                        this.loadUserRaffles(true);
                    }, 3000);
                }
            });
        },

        /**
         * Генерація унікального ID транзакції
         * @returns {string} Унікальний ID транзакції
         * @private
         */
        _generateTransactionId: function() {
            // Покращено генерацію унікального ID
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 11);
            const counter = (this.transactionCounter = (this.transactionCounter || 0) + 1);
            return `txn_${timestamp}_${random}_${counter}`;
        },

        /**
         * Запис транзакції в журнал для діагностики
         * @param {Object} transaction - Дані транзакції
         * @private
         */
        _logTransaction: function(transaction) {
            // Додаємо часову мітку, якщо її немає
            if (!transaction.timestamp) {
                transaction.timestamp = Date.now();
            }

            // Додаємо запис у журнал
            this.transactionLog.unshift(transaction);

            // Обмежуємо розмір журналу
            if (this.transactionLog.length > this.maxLogSize) {
                this.transactionLog = this.transactionLog.slice(0, this.maxLogSize);
            }

            // Спроба збереження журналу для діагностики
            try {
                localStorage.setItem('winix_transaction_log', JSON.stringify(this.transactionLog.slice(0, 10)));
            } catch (e) {
                // Ігноруємо помилки
            }
        },

        /**
         * Скидання стану кнопки участі
         * @param {string} raffleId - ID розіграшу
         * @private
         */
        _resetButtonState: function(raffleId) {
            const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);

            buttons.forEach(button => {
                // Видаляємо клас обробки
                button.classList.remove('processing');
                button.removeAttribute('data-processing');

                // Розблоковуємо кнопку
                button.disabled = false;

                // Якщо користувач уже бере участь, відображаємо відповідний стан
                if (this.participatingRaffles.has(raffleId)) {
                    const ticketCount = this.userRaffleTickets[raffleId] || 1;
                    const isMini = button.classList.contains('mini-raffle-button');

                    button.textContent = isMini ?
                        `Додати ще білет (${ticketCount})` :
                        `Додати ще білет (у вас: ${ticketCount})`;

                    button.classList.add('participating');
                } else {
                    // Відновлюємо оригінальний текст кнопки
                    const originalText = button.getAttribute('data-original-text');

                    if (originalText) {
                        button.textContent = originalText;
                    } else {
                        // Встановлюємо стандартний текст, якщо оригінальний не знайдено
                        const entryFee = button.getAttribute('data-entry-fee') || '1';
                        button.textContent = button.classList.contains('mini-raffle-button') ?
                            'Взяти участь' :
                            `Взяти участь за ${entryFee} жетон${parseInt(entryFee) > 1 ? 'и' : ''}`;
                    }

                    button.classList.remove('participating');
                }
            });
        },

        /**
         * Генерація події про успішну участь у розіграші
         * @param {string} raffleId - ID розіграшу
         * @param {number} ticketCount - Кількість білетів
         * @private
         */
        _triggerParticipationEvent: function(raffleId, ticketCount) {
            document.dispatchEvent(new CustomEvent('raffle-participation', {
                detail: {
                    successful: true,
                    raffleId: raffleId,
                    ticketCount: ticketCount
                }
            }));
        },

        /**
         * Завантаження розіграшів з участю користувача
         * @param {boolean} forceRefresh - Примусове оновлення
         * @returns {Promise<Object>} - Результат завантаження
         */
        loadUserRaffles: async function(forceRefresh = false) {
            // Відстеження стану завантаження
            if (this._loadingUserRaffles && !forceRefresh) {
                console.log('⏳ Завантаження розіграшів користувача вже виконується');
                return;
            }

            // Захист від частих запитів
            const now = Date.now();
            if (!forceRefresh && now - this.lastSyncTime < 5000) {
                console.log('⏳ Занадто часте оновлення, пропускаємо запит');
                return;
            }

            this._loadingUserRaffles = true;
            this.isSyncInProgress = true;

            // Інкрементуємо лічильник синхронізацій для дебагу
            this.syncCounter++;
            const syncId = this.syncCounter;
            console.log(`🔄 Початок синхронізації #${syncId}`);

            try {
                // Отримання ID користувача
                const userId = WinixRaffles.state.telegramId ||
                              (window.WinixAPI ? window.WinixAPI.getUserId() : null);

                if (!userId) {
                    console.warn('⚠️ Не вдалося визначити ID користувача для завантаження розіграшів');
                    return;
                }

                // Перед запитом спочатку оновлюємо UI на основі кешованих даних
                this.updateParticipationButtons();

                // Перевірка наявності API
                if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
                    console.warn('⚠️ WinixAPI.apiRequest не доступний');
                    this._loadingUserRaffles = false;
                    this.isSyncInProgress = false;
                    return;
                }

                // Зберігаємо попередній стан для порівняння
                const prevParticipatingRaffles = new Set(this.participatingRaffles);
                const prevTickets = {...this.userRaffleTickets};

                // Запит до API з додатковими опціями для надійності
                const response = await WinixAPI.apiRequest(`user/${userId}/raffles`, 'GET', null, {
                    suppressErrors: true,
                    hideLoader: true,
                    timeout: 10000,
                    allowParallel: true,
                    retries: 2
                });

                if (response && response.status === 'success' && Array.isArray(response.data)) {
                    // Перевіряємо чи є зміни
                    let hasChanges = false;

                    // Створюємо проміжні об'єкти для коректного порівняння
                    const newParticipating = new Set();
                    const newTickets = {};

                    // Обробляємо нові дані
                    response.data.forEach(raffle => {
                        if (raffle.raffle_id) {
                            // Додаємо до тимчасової множини участі
                            newParticipating.add(raffle.raffle_id);

                            // Зберігаємо кількість білетів у проміжному об'єкті
                            newTickets[raffle.raffle_id] = raffle.entry_count || 1;

                            // Перевіряємо чи є зміни
                            if (!prevParticipatingRaffles.has(raffle.raffle_id) ||
                                prevTickets[raffle.raffle_id] !== (raffle.entry_count || 1)) {
                                hasChanges = true;
                            }
                        }
                    });

                    // Перевіряємо на видалені розіграші
                    prevParticipatingRaffles.forEach(raffleId => {
                        if (!newParticipating.has(raffleId)) {
                            hasChanges = true;
                        }
                    });

                    // Очищаємо поточні дані та застосовуємо нові
                    this.participatingRaffles.clear();
                    this.userRaffleTickets = {};

                    // Обробляємо нові дані
                    response.data.forEach(raffle => {
                        if (raffle.raffle_id) {
                            // Додаємо до множини участі
                            this.participatingRaffles.add(raffle.raffle_id);

                            // Зберігаємо кількість білетів
                            this.userRaffleTickets[raffle.raffle_id] = raffle.entry_count || 1;
                        }
                    });

                    console.log(`✅ Користувач бере участь у ${this.participatingRaffles.size} розіграшах (синхронізація #${syncId})`);

                    // Якщо були зміни, логуємо їх
                    if (hasChanges) {
                        console.log('🔄 Виявлено зміни в участі користувача під час синхронізації #' + syncId);
                    }

                    // Зберігаємо дані в localStorage
                    this._saveParticipationToStorage();

                    // Оновлюємо час останньої синхронізації
                    this.lastSyncTime = Date.now();

                    // Оновлюємо кнопки участі тільки якщо були зміни
                    if (hasChanges) {
                        this.updateParticipationButtons();
                    }
                } else if (response && response.status === 'error') {
                    console.warn(`⚠️ Помилка завантаження розіграшів: ${response.message}`);

                    // Якщо помилка 429 (занадто багато запитів), повторюємо запит пізніше
                    if (response.message && response.message.includes('занадто багато запитів')) {
                        setTimeout(() => this.loadUserRaffles(), 5000);
                    }
                }
            } catch (error) {
                console.error('❌ Помилка завантаження розіграшів користувача:', error);
            } finally {
                console.log(`✅ Завершення синхронізації #${syncId}`);
                this._loadingUserRaffles = false;
                this.isSyncInProgress = false;
            }
        },

        /**
         * Оновлення відображення кнопок участі
         */
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
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Помилка відновлення стану участі:', e);
                }

                // Отримуємо всі кнопки участі
                const buttons = document.querySelectorAll('.join-button, .mini-raffle-button');
                if (!buttons.length) return;

                // Обробляємо кожну кнопку
                buttons.forEach(button => {
                    const raffleId = button.getAttribute('data-raffle-id');
                    if (!raffleId) return;

                    // Перевіряємо, чи користувач бере участь у розіграші
                    const isParticipating = this.participatingRaffles.has(raffleId);

                    // Перевіряємо, чи розіграш недійсний
                    const isInvalid = this.invalidRaffleIds.has(raffleId) ||
                                    (WinixRaffles.state.invalidRaffleIds &&
                                     WinixRaffles.state.invalidRaffleIds.has(raffleId));

                    // Перевіряємо, чи кнопка в процесі обробки
                    const isProcessing = this.activeTransactions.has(raffleId) ||
                                       this.pendingRequests[raffleId];

                    // Оновлюємо стан кнопки відповідно до перевірок
                    if (isInvalid) {
                        // Для недійсних розіграшів
                        button.textContent = 'Розіграш завершено';
                        button.classList.add('disabled');
                        button.disabled = true;
                    } else if (isProcessing) {
                        // Для кнопок у процесі обробки
                        button.textContent = 'Обробка...';
                        button.classList.add('processing');
                        button.disabled = true;
                    } else if (isParticipating) {
                        // Для розіграшів з участю
                        const ticketCount = this.userRaffleTickets[raffleId] || 1;
                        const isMini = button.classList.contains('mini-raffle-button');

                        button.textContent = isMini ?
                            `Додати ще білет (${ticketCount})` :
                            `Додати ще білет (у вас: ${ticketCount})`;

                        button.classList.add('participating');
                        button.classList.remove('processing');
                        button.disabled = false;
                    } else {
                        // Для розіграшів без участі
                        const entryFee = button.getAttribute('data-entry-fee') || '1';

                        // Відновлюємо оригінальний текст
                        const originalText = button.getAttribute('data-original-text');
                        if (originalText && !button.textContent.includes('Взяти участь')) {
                            button.textContent = originalText;
                        } else {
                            // Або встановлюємо стандартний текст
                            button.textContent = button.classList.contains('mini-raffle-button') ?
                                'Взяти участь' :
                                `Взяти участь за ${entryFee} жетон${parseInt(entryFee) > 1 ? 'и' : ''}`;
                        }

                        button.classList.remove('participating', 'processing');
                        button.disabled = false;
                    }
                });
            } catch (error) {
                console.error("❌ Помилка при оновленні кнопок участі:", error);
            }
        },

        /**
         * Перевірка валідності UUID
         * @param {string} id - UUID для перевірки
         * @returns {boolean} Результат перевірки
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
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return uuidRegex.test(id);
        },

        /**
         * Участь у розіграші
         * @param {string} raffleId - ID розіграшу
         * @param {string} raffleType - Тип розіграшу (daily/main)
         * @param {number} entryCount - Кількість білетів
         * @returns {Promise<Object>} - Результат участі
         */
        participateInRaffle: async function(raffleId, raffleType, entryCount = 1) {
            console.log(`🎯 Спроба участі у розіграші ${raffleId}, кількість: ${entryCount}`);

            // 1. ВАЛІДАЦІЯ ПАРАМЕТРІВ
            if (!raffleId) {
                console.error('❌ Не вказано ID розіграшу');
                return Promise.reject(new Error('Не вказано ID розіграшу'));
            }

            if (!this.isValidUUID(raffleId)) {
                console.error('❌ Невалідний ідентифікатор розіграшу');
                return Promise.reject(new Error('Невалідний ідентифікатор розіграшу'));
            }

            // 2. ГЛОБАЛЬНЕ БЛОКУВАННЯ ЗАПИТІВ
            if (this.requestLock) {
                console.warn('⚠️ Глобальне блокування активне, запит відхилено');
                return {
                    success: false,
                    message: 'Система тимчасово недоступна, спробуйте за кілька секунд'
                };
            }

            // 3. ПЕРЕВІРКА ОБМЕЖЕНЬ КОНКРЕТНОГО РОЗІГРАШУ
            if (this.pendingRequests[raffleId]) {
                console.warn(`⚠️ Вже є запит для розіграшу ${raffleId}`);
                return {
                    success: false,
                    message: 'Запит для цього розіграшу вже обробляється'
                };
            }

            // 4. ЧАСОВИЙ ІНТЕРВАЛ
            const now = Date.now();
            const lastRequestTime = this.lastRequestTimes[raffleId] || 0;
            const timeSinceLastRequest = now - lastRequestTime;

            if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
                console.warn(`⚠️ Надто швидкий запит для розіграшу ${raffleId}`);
                return {
                    success: false,
                    message: 'Будь ласка, зачекайте перед наступною спробою'
                };
            }

            // 5. ПЕРЕВІРКА НА НЕВАЛІДНІСТЬ РОЗІГРАШУ
            if (this.invalidRaffleIds.has(raffleId) ||
                (WinixRaffles.state.invalidRaffleIds && WinixRaffles.state.invalidRaffleIds.has(raffleId))) {
                console.warn(`⚠️ Невалідний розіграш ${raffleId}`);
                return {
                    success: false,
                    message: 'Розіграш вже завершено або недоступний'
                };
            }

            // 6. ГЕНЕРАЦІЯ УНІКАЛЬНОГО ID ТРАНЗАКЦІЇ
            const transactionId = this._generateTransactionId();

            // 7. БЛОКУВАННЯ ЗАПИТІВ ДЛЯ ЦЬОГО РОЗІГРАШУ
            this.pendingRequests[raffleId] = {
                id: transactionId,
                timestamp: now,
                entryCount: entryCount,
                raffleType: raffleType,
                status: 'pending'
            };

            // 8. ОНОВЛЕННЯ ЛІЧИЛЬНИКА ТА ЧАСОВИХ МІТОК
            this.totalRequestCount++;
            this.lastRequestTimes[raffleId] = now;

            // 9. ЛОГУВАННЯ ПОЧАТКУ ТРАНЗАКЦІЇ
            this._logTransaction({
                type: 'start',
                raffleId: raffleId,
                transactionId: transactionId,
                timestamp: now,
                entryCount: entryCount
            });

            // 10. ЗБЕРЕЖЕННЯ ДАНИХ ПРО ТРАНЗАКЦІЮ ДЛЯ ВІДНОВЛЕННЯ
            try {
                const pendingTransaction = {
                    raffleId: raffleId,
                    timestamp: now,
                    transactionId: transactionId,
                    entryCount: entryCount,
                    status: 'pending'
                };

                let existingTransactions = [];
                try {
                    existingTransactions = JSON.parse(localStorage.getItem('winix_pending_transactions') || '[]');
                    if (!Array.isArray(existingTransactions)) existingTransactions = [];
                } catch (e) {
                    console.warn('⚠️ Проблема з парсингом транзакцій:', e);
                    existingTransactions = [];
                }

                // Очищаємо старі транзакції
                const validTransactions = existingTransactions.filter(
                    t => (now - t.timestamp < 30 * 60 * 1000)
                );

                // Додаємо нову транзакцію
                validTransactions.push(pendingTransaction);

                // Зберігаємо оновлений список
                localStorage.setItem('winix_pending_transactions', JSON.stringify(validTransactions));
            } catch (e) {
                console.warn('⚠️ Помилка збереження даних транзакції:', e);
            }

            try {
                // 11. ПОКАЗУЄМО ІНДИКАТОР ЗАВАНТАЖЕННЯ
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }

                // 12. ОТРИМАННЯ ID КОРИСТУВАЧА
                const userId = WinixRaffles.state.telegramId ||
                              (window.WinixAPI ? window.WinixAPI.getUserId() : null);

                if (!userId) {
                    throw new Error('Не вдалося визначити ваш ID');
                }

                // 13. ПЕРЕВІРКА НАЯВНОСТІ API
                if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
                    throw new Error('API недоступний. Оновіть сторінку і спробуйте знову.');
                }

                // 14. БУДУЄМО ЗАПИТ
                const requestData = {
                    raffle_id: raffleId,
                    entry_count: entryCount,
                    _transaction_id: transactionId,
                    _timestamp: now,
                    _client_id: `${userId}_${now}_${Math.random().toString(36).substring(2, 7)}`
                };

                // 15. ВИКОНУЄМО ЗАПИТ ДО СЕРВЕРА
                const endpoint = `user/${userId}/participate-raffle`;
                console.log(`📡 Відправка запиту на участь (T:${transactionId.split('_')[1]})`);

                // ВСТАНОВЛЮЄМО ТАЙМАУТ ДЛЯ АВТОМАТИЧНОГО СКИДАННЯ БЛОКУВАННЯ
                const timeoutId = setTimeout(() => {
                    console.warn(`⚠️ Таймаут запиту для розіграшу ${raffleId}`);
                    delete this.pendingRequests[raffleId];
                    this._resetButtonState(raffleId);
                }, 15000);

                const response = await WinixAPI.apiRequest(endpoint, 'POST', requestData, {
                    timeout: 15000,
                    retries: 1,
                    bypassThrottle: true,
                    allowParallel: false
                });

                // СКАСОВУЄМО ТАЙМАУТ ПРИ ОТРИМАННІ ВІДПОВІДІ
                clearTimeout(timeoutId);

                // 16. ЛОГУЄМО ВІДПОВІДЬ
                console.log(`📩 Отримано відповідь на запит участі (T:${transactionId.split('_')[1]}):`,
                    response.status === 'success' ? 'Успіх' : `Помилка: ${response.message}`);

                // 17. ЛОГУЄМО ЗАВЕРШЕННЯ ТРАНЗАКЦІЇ
                this._logTransaction({
                    type: 'complete',
                    raffleId: raffleId,
                    transactionId: transactionId,
                    success: response.status === 'success',
                    timestamp: Date.now(),
                    duration: Date.now() - now,
                    response: {
                        status: response.status,
                        message: response.message,
                        data: response.data
                    }
                });

                if (response.status === 'success') {
                    // 18. УСПІШНО ОБРОБЛЕНА ВІДПОВІДЬ

                    // 18.1 ОНОВЛЮЄМО СТАТУС ТРАНЗАКЦІЇ
                    this._updateTransactionStatus(raffleId, transactionId, 'completed');

                    // 18.2 ОНОВЛЮЄМО ДАНІ ПРО УЧАСТЬ
                    this.participatingRaffles.add(raffleId);

                    // 18.3 ВИЗНАЧАЄМО КІЛЬКІСТЬ БІЛЕТІВ З ДАНИХ СЕРВЕРА
                    let newTicketCount;
                    if (response.data && typeof response.data.total_entries === 'number') {
                        newTicketCount = response.data.total_entries;
                    } else {
                        // Якщо сервер не повернув дані, робимо додатковий запит
                        console.warn("⚠️ Сервер не повернув дані про кількість білетів, запускаємо синхронізацію");

                        // Оцінюємо кількість білетів локально на основі поточного стану
                        const currentTickets = this.userRaffleTickets[raffleId] || 0;
                        newTicketCount = currentTickets + 1;

                        // Плануємо синхронізацію через 1 секунду
                        setTimeout(() => {
                            this.loadUserRaffles(true);
                        }, 1000);
                    }

                    // 18.4 ОНОВЛЮЄМО ЛОКАЛЬНИЙ СТАН БІЛЕТІВ
                    this.userRaffleTickets[raffleId] = newTicketCount;

                    // 18.5 ОНОВЛЮЄМО БАЛАНС ЖЕТОНІВ - ВИКОРИСТОВУЄМО ТІЛЬКИ ДАНІ СЕРВЕРА
                    if (response.data && typeof response.data.new_coins_balance === 'number') {
                        // Запам'ятовуємо баланс до оновлення для виявлення змін
                        const oldBalance = parseInt(localStorage.getItem('userCoins')) || 0;
                        const newBalance = response.data.new_coins_balance;

                        // Оновлюємо відображення балансу
                        const userCoinsElement = document.getElementById('user-coins');
                        if (userCoinsElement) {
                            // Додаємо анімацію, якщо баланс зменшився
                            if (newBalance < oldBalance) {
                                userCoinsElement.classList.add('decreasing');
                                setTimeout(() => {
                                    userCoinsElement.classList.remove('decreasing');
                                }, 1000);
                            }

                            userCoinsElement.textContent = newBalance;
                        }

                        // Оновлюємо локальне сховище
                        localStorage.setItem('userCoins', newBalance.toString());
                        localStorage.setItem('winix_coins', newBalance.toString());
                        localStorage.setItem('winix_balance_update_time', Date.now().toString());

                        // Додаємо подію для точної синхронізації з іншими модулями
                        document.dispatchEvent(new CustomEvent('balance-updated', {
                            detail: {
                                oldBalance: oldBalance,
                                newBalance: newBalance,
                                source: 'participation.js'
                            }
                        }));
                    } else {
                        // Якщо сервер не повернув баланс, робимо додатковий запит
                        console.warn("⚠️ Сервер не повернув дані про новий баланс, отримуємо баланс");
                        this._getServerBalance();
                    }

                    // 18.6 ЗБЕРІГАЄМО ОНОВЛЕНИЙ СТАН
                    this._saveParticipationToStorage();

                    // 18.7 ОНОВЛЮЄМО КНОПКИ УЧАСТІ
                    this.updateParticipationButtons();

                    // 18.8 ГЕНЕРУЄМО ПОВІДОМЛЕННЯ ПРО УСПІХ
                    let message;
                    if (response.data && response.data.message) {
                        message = response.data.message;
                    } else {
                        // Формуємо стандартне повідомлення
                        message = newTicketCount > 1 ?
                            `Додано ще білет! Тепер у вас ${newTicketCount} білетів` :
                            'Ви успішно взяли участь у розіграші';
                    }

                    // 18.9 ПОКАЗУЄМО ПОВІДОМЛЕННЯ
                    if (typeof window.showToast === 'function') {
                        window.showToast(message, 'success');
                    }

                    // 18.10 ВІДПРАВЛЯЄМО ПОДІЮ ПРО ОНОВЛЕННЯ ДАНИХ КОРИСТУВАЧА
                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                        detail: {
                            userData: {
                                coins: response.data.new_coins_balance,
                                last_update: Date.now()
                            },
                            source: 'participation.js'
                        }
                    }));

                    // 18.11 ОНОВЛЮЄМО КІЛЬКІСТЬ УЧАСНИКІВ
                    this.updateParticipantsCount(raffleId);

                    // 18.12 ПЛАНУВАННЯ ПІДТВЕРДЖУЮЧОЇ СИНХРОНІЗАЦІЇ
                    setTimeout(() => {
                        this.confirmParticipation(raffleId).catch(e =>
                            console.warn('⚠️ Помилка підтвердження участі:', e)
                        );
                    }, 3000);

                    // 18.13 ПОВЕРНЕННЯ РЕЗУЛЬТАТУ
                    return {
                        success: true,
                        data: response.data,
                        message: message
                    };
                } else {
                    // 19. ОБРОБКА ПОМИЛКИ

                    // 19.1 ОНОВЛЮЄМО СТАТУС ТРАНЗАКЦІЇ
                    this._updateTransactionStatus(raffleId, transactionId, 'failed', response.message);

                    // 19.2 ОБРОБКА СПЕЦИФІЧНИХ ПОМИЛОК
                    if (response.message && response.message.includes('занадто багато запитів')) {
                        return {
                            success: false,
                            message: 'Забагато запитів. Спробуйте через 15 секунд'
                        };
                    } else if (response.message &&
                               (response.message.includes('raffle_not_found') ||
                               response.message.includes('завершено'))) {
                        // Додаємо до недійсних
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
                // 20. ОБРОБКА КРИТИЧНИХ ПОМИЛОК
                console.error(`❌ Помилка участі в розіграші ${raffleId}:`, error);

                // 20.1 ЛОГУЄМО ПОМИЛКУ ТРАНЗАКЦІЇ
                this._logTransaction({
                    type: 'error',
                    raffleId: raffleId,
                    transactionId: transactionId,
                    error: error.message || 'Невідома помилка',
                    timestamp: Date.now(),
                    duration: Date.now() - now
                });

                // 20.2 ОНОВЛЮЄМО СТАТУС ТРАНЗАКЦІЇ
                this._updateTransactionStatus(raffleId, transactionId, 'failed', error.message);

                // 20.3 ПЕРЕВІРКА НА ЗАВЕРШЕННЯ РОЗІГРАШУ
                if (error.message &&
                   (error.message.includes('завершено') ||
                    error.message.includes('not found') ||
                    error.message.includes('не знайдено'))) {

                    this.addInvalidRaffleId(raffleId);
                }

                return Promise.reject(error);
            } finally {
                // 21. ЗАВЕРШАЛЬНІ ДІЇ (ВИКОНУЮТЬСЯ ЗАВЖДИ)

                // 21.1 ВИДАЛЯЄМО БЛОКУВАННЯ ДЛЯ ЦЬОГО РОЗІГРАШУ
                delete this.pendingRequests[raffleId];

                // 21.2 ПРИХОВУЄМО ІНДИКАТОР ЗАВАНТАЖЕННЯ
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }
            }
        },

        /**
         * Оновлення статусу транзакції в localStorage
         * @param {string} raffleId - ID розіграшу
         * @param {string} transactionId - ID транзакції
         * @param {string} status - Новий статус
         * @param {string} [message] - Повідомлення (опціонально)
         * @private
         */
        _updateTransactionStatus: function(raffleId, transactionId, status, message) {
            try {
                const transactions = JSON.parse(localStorage.getItem('winix_pending_transactions') || '[]');
                const updatedTransactions = transactions.map(t => {
                    if (t.raffleId === raffleId && t.transactionId === transactionId) {
                        return {
                            ...t,
                            status: status,
                            message: message,
                            completedAt: Date.now()
                        };
                    }
                    return t;
                });

                localStorage.setItem('winix_pending_transactions', JSON.stringify(updatedTransactions));
            } catch (e) {
                console.warn('⚠️ Помилка оновлення статусу транзакції:', e);
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
         * Підтвердження участі в розіграші
         * Використовується для додаткової перевірки після успішної участі
         */
        confirmParticipation: async function(raffleId) {
            if (!raffleId) return;

            console.log(`🔍 Підтвердження участі в розіграші ${raffleId}`);

            try {
                // Отримуємо ID користувача
                const userId = WinixRaffles.state.telegramId ||
                               (window.WinixAPI ? window.WinixAPI.getUserId() : null);

                if (!userId) {
                    console.warn('⚠️ Не вдалося визначити ID користувача для підтвердження');
                    return;
                }

                // Запит на отримання поточного стану розіграшів користувача
                const response = await WinixAPI.apiRequest(`user/${userId}/raffles`, 'GET', null, {
                    suppressErrors: true,
                    hideLoader: true,
                    timeout: 10000
                });

                if (response && response.status === 'success' && Array.isArray(response.data)) {
                    // Шукаємо розіграш у відповіді
                    const foundRaffle = response.data.find(r => r.raffle_id === raffleId);

                    if (foundRaffle) {
                        console.log(`✅ Підтверджено участь у розіграші ${raffleId}, білетів: ${foundRaffle.entry_count || 1}`);

                        // Оновлюємо локальні дані
                        this.participatingRaffles.add(raffleId);
                        this.userRaffleTickets[raffleId] = foundRaffle.entry_count || 1;

                        // Зберігаємо оновлені дані
                        this._saveParticipationToStorage();

                        // Оновлюємо відображення
                        this.updateParticipationButtons();
                    } else {
                        console.warn(`⚠️ Розіграш ${raffleId} не знайдено у відповіді сервера`);

                        // Перевіряємо, чи ми вважаємо, що беремо участь
                        if (this.participatingRaffles.has(raffleId)) {
                            console.warn(`⚠️ Виявлено розбіжність: клієнт думає, що бере участь, але сервер - ні`);

                            // Запускаємо повну синхронізацію
                            setTimeout(() => {
                                this.syncWithServer();
                            }, 1000);
                        }
                    }
                } else {
                    console.warn('⚠️ Не вдалося отримати дані для підтвердження участі');
                }
            } catch (error) {
                console.warn('⚠️ Помилка підтвердження участі:', error);
            }
        },

        /**
         * Перевірка та виправлення стану участі
         * Викликайте періодично, щоб переконатися, що дані відповідають реальності
         */
        verifyAndFixParticipationState: async function() {
            console.log('🔍 Перевірка та виправлення стану участі');

            try {
                // Отримуємо ID користувача
                const userId = WinixRaffles.state.telegramId ||
                              (window.WinixAPI ? window.WinixAPI.getUserId() : null);

                if (!userId) {
                    console.warn('⚠️ Не вдалося визначити ID користувача для перевірки');
                    return false;
                }

                // Зберігаємо поточний стан
                const currentRaffles = new Set(this.participatingRaffles);
                const currentTickets = {...this.userRaffleTickets};

                // Отримуємо актуальні дані з сервера
                const response = await WinixAPI.apiRequest(`user/${userId}/raffles`, 'GET', null, {
                    suppressErrors: true,
                    hideLoader: true,
                    timeout: 10000
                });

                if (response && response.status === 'success' && Array.isArray(response.data)) {
                    // Створюємо множину розіграшів з сервера
                    const serverRaffles = new Set();
                    const serverTickets = {};

                    // Заповнюємо дані з сервера
                    response.data.forEach(raffle => {
                        if (raffle.raffle_id) {
                            serverRaffles.add(raffle.raffle_id);
                            serverTickets[raffle.raffle_id] = raffle.entry_count || 1;
                        }
                    });

                    // Перевіряємо розбіжності в участі
                    let hasChanges = false;

                    // 1. Розіграші, які є локально, але відсутні на сервері
                    currentRaffles.forEach(raffleId => {
                        if (!serverRaffles.has(raffleId)) {
                            console.warn(`⚠️ Розіграш ${raffleId} є локально, але відсутній на сервері`);
                            hasChanges = true;
                        }
                    });

                    // 2. Розіграші, які є на сервері, але відсутні локально
                    serverRaffles.forEach(raffleId => {
                        if (!currentRaffles.has(raffleId)) {
                            console.warn(`⚠️ Розіграш ${raffleId} є на сервері, але відсутній локально`);
                            hasChanges = true;
                        }
                    });

                    // 3. Розбіжності в кількості білетів
                    for (const raffleId of serverRaffles) {
                        if (currentTickets[raffleId] !== serverTickets[raffleId]) {
                            console.warn(`⚠️ Розбіжність у кількості білетів для ${raffleId}: ` +
                                        `локально ${currentTickets[raffleId] || 0}, на сервері ${serverTickets[raffleId]}`);
                            hasChanges = true;
                        }
                    }

                    // Якщо є розбіжності, застосовуємо дані з сервера
                    if (hasChanges) {
                        console.log('🔄 Виправлення розбіжностей стану участі');

                        // Очищаємо поточні дані
                        this.participatingRaffles.clear();
                        this.userRaffleTickets = {};

                        // Застосовуємо дані з сервера
                        response.data.forEach(raffle => {
                            if (raffle.raffle_id) {
                                this.participatingRaffles.add(raffle.raffle_id);
                                this.userRaffleTickets[raffle.raffle_id] = raffle.entry_count || 1;
                            }
                        });

                        // Зберігаємо в localStorage
                        this._saveParticipationToStorage();

                        // Оновлюємо відображення
                        this.updateParticipationButtons();

                        // Показуємо повідомлення про синхронізацію
                        if (typeof window.showToast === 'function') {
                            window.showToast('Дані про участь синхронізовано з сервером', 'info');
                        }

                        console.log('✅ Стан участі виправлено');
                        return true;
                    } else {
                        console.log('✅ Стан участі відповідає серверу, виправлення не потрібні');
                        return true;
                    }
                } else {
                    console.warn('⚠️ Не вдалося отримати дані з сервера для перевірки');
                    return false;
                }
            } catch (error) {
                console.error('❌ Помилка перевірки та виправлення стану:', error);
                return false;
            }
        },

        /**
         * Додає розіграш до списку недійсних
         * @param {string} raffleId - ID розіграшу
         */
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
                console.warn('⚠️ Не вдалося зберегти недійсні розіграші:', e);
            }

            console.log(`⚠️ Додано розіграш ${raffleId} до списку недійсних`);

            // Оновлюємо відображення кнопок участі
            this.updateParticipationButtons();
        },

        /**
         * Очищення списку недійсних розіграшів
         */
        clearInvalidRaffleIds: function() {
            this.invalidRaffleIds.clear();

            // Також очищаємо глобальний список
            if (WinixRaffles.state.invalidRaffleIds) {
                WinixRaffles.state.invalidRaffleIds.clear();
            }

            // Очищаємо localStorage
            try {
                localStorage.removeItem('winix_invalid_raffles');
            } catch (e) {
                console.warn('⚠️ Не вдалося очистити кеш невалідних розіграшів:', e);
            }

            console.log('🧹 Очищено список недійсних розіграшів');
        },

        /**
         * Скидання стану модуля участі
         */
        resetState: function() {
            console.log('🔄 Виконується скидання стану модуля участі...');

            // Скидаємо всі активні транзакції
            this.activeTransactions.clear();

            // Скидаємо глобальне блокування
            this.requestLock = false;

            // Очищення обмежень розіграшів
            this.pendingRequests = {};

            // Скидаємо часові мітки запитів
            this.lastRequestTimes = {};

            // Скидаємо стан кнопок
            document.querySelectorAll('.join-button.processing, .mini-raffle-button.processing').forEach(button => {
                // Отримуємо ID розіграшу
                const raffleId = button.getAttribute('data-raffle-id');
                if (raffleId) {
                    this._resetButtonState(raffleId);
                } else {
                    // Якщо ID немає, просто скидаємо стан кнопки
                    button.classList.remove('processing');
                    button.disabled = false;

                    // Відновлюємо оригінальний текст
                    const originalText = button.getAttribute('data-original-text');
                    if (originalText) {
                        button.textContent = originalText;
                    }
                }
            });

            // Оновлюємо відображення кнопок участі
            this.updateParticipationButtons();

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            // Скидаємо прапорець синхронізації
            this.isSyncInProgress = false;

            // Очищаємо таймер синхронізації
            if (this.syncTimer) {
                clearTimeout(this.syncTimer);
                this.syncTimer = null;
            }

            console.log('✅ Стан модуля участі успішно скинуто');
            return true;
        },

        /**
         * Повна синхронізація стану участі з сервером
         * @returns {Promise<boolean>} - Результат синхронізації
         */
        syncWithServer: async function() {
            console.log('🔄 Запуск повної синхронізації з сервером...');

            // Перевірка чи синхронізація вже виконується
            if (this.isSyncInProgress) {
                console.log('⏳ Синхронізація вже виконується, пропускаємо дублікат');
                return false;
            }

            this.isSyncInProgress = true;

            try {
                // Скидаємо всі активні транзакції
                this.activeTransactions.clear();

                // Скидаємо глобальне блокування
                this.requestLock = false;

                // Очищення обмежень розіграшів
                this.pendingRequests = {};

                // Завантажуємо актуальні дані про участь користувача
                await this.loadUserRaffles(true);

                // Також оновлюємо баланс
                await this._getServerBalance();

                // Оновлюємо відображення кнопок участі
                this.updateParticipationButtons();

                // Оновлюємо час останньої синхронізації
                this.lastSyncTime = Date.now();

                console.log('✅ Синхронізація з сервером успішно завершена');
                return true;
            } catch (error) {
                console.error('❌ Помилка синхронізації з сервером:', error);
                return false;
            } finally {
                this.isSyncInProgress = false;
            }
        },

        /**
         * Отримання діагностичної інформації про стан участі
         * @returns {Object} - Діагностична інформація
         */
        getDiagnosticInfo: function() {
            return {
                participatingRaffles: Array.from(this.participatingRaffles),
                ticketCounts: this.userRaffleTickets,
                invalidRaffles: Array.from(this.invalidRaffleIds),
                activeTransactions: Array.from(this.activeTransactions.entries()),
                pendingRequests: this.pendingRequests,
                lastRequestTimes: this.lastRequestTimes,
                transactionLog: this.transactionLog,
                lastSyncTime: this.lastSyncTime,
                syncCounter: this.syncCounter,
                isSyncInProgress: this.isSyncInProgress,
                requestLock: this.requestLock,
                totalRequestCount: this.totalRequestCount,
                localOperations: this.localOperations.slice(0, 10), // Останні 10 операцій
                lastBalanceUpdateTime: this.lastBalanceUpdateTime,
                lastKnownBalance: this.lastKnownBalance
            };
        }
    };

    // Додаємо модуль участі до головного модуля розіграшів
    WinixRaffles.participation = participation;

    // Ініціалізація модуля при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        // Додаємо класи для анімації зміни учасників
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
            
            /* Анімація зменшення кількості жетонів */
            @keyframes decrease-coins {
                0% { color: #FF5722; transform: scale(1.1); text-shadow: 0 0 5px rgba(255, 87, 34, 0.7); }
                50% { color: #FF5722; transform: scale(1.15); text-shadow: 0 0 10px rgba(255, 87, 34, 0.5); }
                100% { color: inherit; transform: scale(1); }
            }
            
            /* Анімація збільшення кількості жетонів */
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

        if (WinixRaffles.state.isInitialized) {
            participation.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                participation.init();
            });
        }
    });

    // Глобальний обробник помилок для автоматичного скидання стану при критичних помилках
    window.addEventListener('error', function(event) {
        console.error('🚨 Глобальна помилка в participation:', event.error);

        if (participation && (participation.activeTransactions.size > 0 || Object.keys(participation.pendingRequests).length > 0)) {
            console.warn('⚠️ Виявлено активні транзакції під час помилки. Скидаємо стан...');
            participation.resetState();
        }

        // Приховуємо індикатор завантаження
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }
    });

    // Обробник необроблених помилок Promise
    window.addEventListener('unhandledrejection', function(event) {
        if (participation && (participation.activeTransactions.size > 0 || Object.keys(participation.pendingRequests).length > 0)) {
            console.warn('⚠️ Виявлено необроблену Promise помилку. Скидаємо стан...');
            participation.resetState();
        }
    });

    console.log('✅ Модуль участі успішно ініціалізовано');
})();