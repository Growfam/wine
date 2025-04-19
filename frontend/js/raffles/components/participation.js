/**
 * WINIX - Система розіграшів (participation.js)
 * Виправлений модуль для обробки участі користувача в розіграшах
 * Покращено синхронізацію та усунено проблеми з дублюванням участі
 * @version 2.1.0
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
        // Множина ID розіграшів, у яких користувач уже бере участь
        participatingRaffles: new Set(),

        // Кількість білетів користувача для кожного розіграшу
        userRaffleTickets: {},

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
        MIN_REQUEST_INTERVAL: 2000, // Збільшено з 1500 до 2000

        // Таймаут для виявлення "зависаючих" запитів (мс)
        REQUEST_TIMEOUT: 15000,

        // Стан обробника моніторингу транзакцій
        transactionMonitorActive: false,

        // Час останнього оновлення синхронізації
        lastSyncTime: 0,

        // НОВЕ: Додано лічильник для дебагу проблем синхронізації
        syncCounter: 0,

        // НОВЕ: Додано таймер для відкладеної синхронізації
        syncTimer: null,

        // НОВЕ: Додано прапорець для запобігання повторним синхронізаціям
        isSyncInProgress: false,

        // Ініціалізація модуля
        init: function() {
            console.log('🎯 Ініціалізація модуля участі в розіграшах...');

            // НОВЕ: Додано очищення стану перед ініціалізацією
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
            this.loadUserRaffles(true); // ЗМІНЕНО: Додано true для примусового оновлення

            // Додавання обробників подій
            this._setupEventListeners();

            // Синхронізація з локальною базою даних
            this._syncWithIndexedDB();

            console.log('✅ Модуль участі в розіграшах успішно ініціалізовано');
        },

        /**
         * НОВЕ: Очищення стану перед ініціалізацією
         * Додано для запобігання проблем зі збереженими даними
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

                        // НОВЕ: Ініціюємо примусову синхронізацію з сервером
                        this._scheduleForcedSync();
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

                    // НОВЕ: Більш агресивна синхронізація при виявленні незавершених транзакцій
                    setTimeout(() => {
                        this.loadUserRaffles(true);

                        // Другий запит через 3 секунди для більшої надійності
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

                // НОВЕ: При помилці очищаємо список транзакцій
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

                        // НОВЕ: Примусова синхронізація при виявленні зависаючих запитів
                        this._scheduleForcedSync();
                    }

                    // Перевіряємо, коли останній раз оновлювались дані
                    if (now - this.lastSyncTime > 30000) { // ЗМІНЕНО: Зменшено до 30 секунд з 60
                        // Якщо давно не оновлювали, завантажуємо свіжі дані
                        setTimeout(() => {
                            this.loadUserRaffles(true);
                            this.lastSyncTime = now;
                        }, 1000);
                    }
                }
            });

            // Додаємо обробник для відновлення з кешу при перезавантаженні сторінки
            window.addEventListener('pageshow', (event) => {
                if (event.persisted) {
                    console.log("📝 Сторінка відновлена з кешу, оновлюємо стан");
                    this.activeTransactions.clear();

                    // НОВЕ: Примусова синхронізація при відновленні з кешу
                    setTimeout(() => {
                        this.loadUserRaffles(true);
                    }, 500);
                }
            });

            // НОВЕ: Додано періодичне оновлення даних про участь
            // Це важливо для багатьох користувачів, які тримають вкладку відкритою довгий час
            setInterval(() => {
                if (document.visibilityState === 'visible' && !this.isSyncInProgress) {
                    const now = Date.now();
                    if (now - this.lastSyncTime > 5 * 60 * 1000) { // 5 хвилин
                        console.log('🔄 Періодичне оновлення даних участі');
                        this.loadUserRaffles(true);
                    }
                }
            }, 5 * 60 * 1000); // Перевірка кожні 5 хвилин
        },

        /**
         * НОВЕ: Планування примусової синхронізації з сервером
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

                    // НОВЕ: Перевірка на часті кліки
                    const now = Date.now();
                    const lastRequestTime = this.lastRequestTimes[raffleId] || 0;
                    if (now - lastRequestTime < this.MIN_REQUEST_INTERVAL) {
                        if (typeof window.showToast === 'function') {
                            window.showToast('Будь ласка, зачекайте перед наступною спробою', 'info');
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
                                // Додаємо розіграш до списку з участю
                                this.participatingRaffles.add(raffleId);

                                // Оновлюємо кількість білетів
                                const previousTickets = this.userRaffleTickets[raffleId] || 0;
                                const newTicketCount = result.data?.total_entries || previousTickets + 1;
                                this.userRaffleTickets[raffleId] = newTicketCount;

                                // Оновлюємо вигляд кнопки
                                const isMini = participateButton.classList.contains('mini-raffle-button');
                                participateButton.textContent = isMini ?
                                    `Додати ще білет (${newTicketCount})` :
                                    `Додати ще білет (у вас: ${newTicketCount})`;

                                participateButton.classList.add('participating');

                                // Зберігаємо оновлені дані
                                this._saveParticipationToStorage();

                                // Генеруємо подію про успішну участь
                                this._triggerParticipationEvent(raffleId, newTicketCount);

                                // НОВЕ: Плануємо додаткову синхронізацію через деякий час
                                // для забезпечення консистентності стану після успішної участі
                                setTimeout(() => {
                                    this.loadUserRaffles(true);
                                }, 3000);
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
                }

                // Оновлюємо список розіграшів з участю користувача
                setTimeout(() => {
                    this.loadUserRaffles(true); // ЗМІНЕНО: Додано true для примусового оновлення
                }, 500);
            });

            // НОВЕ: Додаємо обробник для події raffle-participation
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
            // НОВЕ: Покращено генерацію унікального ID
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

            // НОВЕ: Спроба збереження журналу для діагностики
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

            // НОВЕ: Захист від частих запитів
            const now = Date.now();
            if (!forceRefresh && now - this.lastSyncTime < 5000) {
                console.log('⏳ Занадто часте оновлення, пропускаємо запит');
                return;
            }

            this._loadingUserRaffles = true;
            this.isSyncInProgress = true;

            // НОВЕ: Інкрементуємо лічильник синхронізацій для дебагу
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

                // НОВЕ: Зберігаємо попередній стан для порівняння
                const prevParticipatingRaffles = new Set(this.participatingRaffles);
                const prevTickets = {...this.userRaffleTickets};

                // Запит до API з додатковими опціями для надійності
                const response = await WinixAPI.apiRequest(`user/${userId}/raffles`, 'GET', null, {
                    suppressErrors: true,
                    hideLoader: true,
                    timeout: 10000,
                    allowParallel: true,
                    retries: 2 // ЗМІНЕНО: Збільшено кількість повторів з 1 до 2
                });

                if (response && response.status === 'success' && Array.isArray(response.data)) {
                    // НОВЕ: Перевіряємо чи є зміни
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
                    const isProcessing = this.activeTransactions.has(raffleId);

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
         * Участь у розіграші
         * @param {string} raffleId - ID розіграшу
         * @param {string} raffleType - Тип розіграшу ('main' або 'daily')
         * @param {number} entryCount - Кількість білетів (за замовчуванням 1)
         * @returns {Promise<Object>} - Результат участі
         */
        participateInRaffle: async function(raffleId, raffleType, entryCount = 1) {
            // Валідація параметрів
            if (!raffleId) {
                return Promise.reject(new Error('Не вказано ID розіграшу'));
            }

            // Перевірка валідності ID розіграшу
            if (!this.isValidUUID(raffleId)) {
                return Promise.reject(new Error('Невалідний ідентифікатор розіграшу'));
            }

            // НОВЕ: Додана логіка для перевірки, що сервер у курсі, що ми вже беремо участь
            // Це допомагає вирішити проблему, коли клієнт думає що він бере участь, а сервер - ні
            if (this.participatingRaffles.has(raffleId)) {
                const shouldVerifyWithServer = Math.random() < 0.3; // 30% ймовірність перевірки

                if (shouldVerifyWithServer) {
                    console.log(`🔍 Попередня перевірка стану участі для розіграшу ${raffleId}`);
                    try {
                        await this.loadUserRaffles(true);

                        // Перевіряємо знову після оновлення
                        if (!this.participatingRaffles.has(raffleId)) {
                            console.warn(`⚠️ Виявлено розбіжність: клієнт думав, що бере участь, але сервер каже що ні (розіграш ${raffleId})`);
                        }
                    } catch (error) {
                        console.warn(`⚠️ Помилка попередньої перевірки: ${error.message}`);
                    }
                }
            }

            // Перевірка на активну транзакцію для цього розіграшу
            if (this.activeTransactions.has(raffleId)) {
                return {
                    success: false,
                    message: 'Запит для цього розіграшу вже обробляється'
                };
            }

            // Перевірка інтервалу між запитами
            const now = Date.now();
            const lastRequestTime = this.lastRequestTimes[raffleId] || 0;

            if (now - lastRequestTime < this.MIN_REQUEST_INTERVAL) {
                return {
                    success: false,
                    message: 'Будь ласка, зачекайте перед наступною спробою'
                };
            }

            // Перевірка, чи розіграш невалідний
            if (this.invalidRaffleIds.has(raffleId) ||
                (WinixRaffles.state.invalidRaffleIds &&
                 WinixRaffles.state.invalidRaffleIds.has(raffleId))) {
                return {
                    success: false,
                    message: 'Розіграш вже завершено або недоступний'
                };
            }

            // Оновлюємо час останнього запиту
            this.lastRequestTimes[raffleId] = now;

            // Створюємо унікальний ID транзакції
            const transactionId = this._generateTransactionId();

            // Додаємо транзакцію до активних
            this.activeTransactions.set(raffleId, {
                id: transactionId,
                timestamp: now,
                type: raffleType,
                entryCount: entryCount
            });

            // Логуємо початок транзакції
            this._logTransaction({
                type: 'start',
                raffleId: raffleId,
                transactionId: transactionId,
                timestamp: now
            });

            // Зберігаємо дані про транзакцію в localStorage для відновлення стану після перезавантаження
            try {
                const pendingTransaction = {
                    raffleId: raffleId,
                    timestamp: now,
                    transactionId: transactionId,
                    entryCount: entryCount,
                    status: 'pending'
                };

                const existingTransactions = JSON.parse(localStorage.getItem('winix_pending_transactions') || '[]');

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
                // Показуємо індикатор завантаження
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }

                // Отримання ID користувача
                const userId = WinixRaffles.state.telegramId ||
                              (window.WinixAPI ? window.WinixAPI.getUserId() : null);

                if (!userId) {
                    throw new Error('Не вдалося визначити ваш ID');
                }

                // Перевірка наявності API
                if (!window.WinixAPI || typeof window.WinixAPI.apiRequest !== 'function') {
                    throw new Error('API недоступний. Оновіть сторінку і спробуйте знову.');
                }

                // Підготовка даних запиту з міткою транзакції
                const requestData = {
                    raffle_id: raffleId,
                    entry_count: entryCount,
                    _transaction_id: transactionId,
                    _timestamp: now,
                    _client_id: `${userId}_${now}_${Math.random().toString(36).substring(2, 7)}` // НОВЕ: Додаємо унікальний ідентифікатор клієнта
                };

                // НОВЕ: Додаємо дані про вже існуючі білети для запобігання дублікатам
                if (this.userRaffleTickets[raffleId]) {
                    requestData._current_tickets = this.userRaffleTickets[raffleId];
                }

                // Запит до API з розширеними опціями
                const response = await WinixAPI.apiRequest(`user/${userId}/participate-raffle`, 'POST', requestData, {
                    timeout: 15000,
                    retries: 2, // ЗМІНЕНО: Збільшено кількість повторів з 1 до 2
                    bypassThrottle: true,
                    allowParallel: false
                });

                // Приховуємо індикатор завантаження
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                // Логуємо завершення транзакції
                this._logTransaction({
                    type: 'complete',
                    raffleId: raffleId,
                    transactionId: transactionId,
                    success: response.status === 'success',
                    timestamp: Date.now(),
                    duration: Date.now() - now
                });

                if (response.status === 'success') {
                    // Оновлюємо статус транзакції на 'completed'
                    this._updateTransactionStatus(raffleId, transactionId, 'completed');

                    // Отримуємо поточний баланс користувача
                    const userCoinsElement = document.getElementById('user-coins');
                    const initialCoins = userCoinsElement ?
                        parseInt(userCoinsElement.textContent) || 0 :
                        parseInt(localStorage.getItem('userCoins') || '0');

                    // Оновлюємо баланс користувача
                    const newCoinsBalance = response.data?.new_coins_balance !== undefined ?
                        response.data.new_coins_balance :
                        (initialCoins - entryCount);

                    // Оновлюємо відображення та кеш
                    if (userCoinsElement) {
                        userCoinsElement.textContent = newCoinsBalance;
                    }

                    localStorage.setItem('userCoins', newCoinsBalance.toString());
                    localStorage.setItem('winix_coins', newCoinsBalance.toString());
                    localStorage.setItem('winix_balance_update_time', Date.now().toString());

                    // Оновлюємо дані про участь
                    this.participatingRaffles.add(raffleId);

                    // ЗМІНЕНО: Використовуємо дані із сервера для оновлення кількості квитків
                    const previousTickets = this.userRaffleTickets[raffleId] || 0;
                    if (response.data && response.data.total_entries) {
                        // Якщо сервер повертає загальну кількість, використовуємо її
                        this.userRaffleTickets[raffleId] = response.data.total_entries;
                    } else {
                        // Інакше додаємо до наявної кількості
                        this.userRaffleTickets[raffleId] = previousTickets + entryCount;
                    }

                    // Зберігаємо оновлений стан
                    this._saveParticipationToStorage();

                    // Оновлюємо кнопки участі
                    this.updateParticipationButtons();

                    // Генеруємо повідомлення про успіх
                    const ticketCount = this.userRaffleTickets[raffleId];
                    const message = previousTickets > 0 ?
                        `Додано ще один білет! Тепер у вас ${ticketCount} білетів` :
                        'Ви успішно взяли участь у розіграші';

                    // Показуємо повідомлення
                    if (typeof window.showToast === 'function') {
                        window.showToast(message, 'success');
                    }

                    // Відправляємо подію про оновлення даних користувача
                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                        detail: {
                            userData: {
                                coins: newCoinsBalance,
                                participations_count: this.participatingRaffles.size,
                                last_update: Date.now()
                            }
                        },
                        source: 'participation.js'
                    }));

                    // Оновлюємо кількість учасників
                    this.updateParticipantsCount(raffleId);

                    // НОВЕ: Плануємо додаткову синхронізацію через кілька секунд
                    // для забезпечення узгодженості даних
                    setTimeout(() => {
                        this.loadUserRaffles(true);
                    }, 3000);

                    return {
                        success: true,
                        data: response.data,
                        message: message
                    };
                } else {
                    // Оновлюємо статус транзакції на 'failed'
                    this._updateTransactionStatus(raffleId, transactionId, 'failed', response.message);

                    // Обробка специфічних помилок
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
                console.error(`❌ Помилка участі в розіграші ${raffleId}:`, error);

                // Приховуємо індикатор завантаження
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                // Логуємо помилку транзакції
                this._logTransaction({
                    type: 'error',
                    raffleId: raffleId,
                    transactionId: transactionId,
                    error: error.message || 'Невідома помилка',
                    timestamp: Date.now(),
                    duration: Date.now() - now
                });

                // Оновлюємо статус транзакції на 'failed'
                this._updateTransactionStatus(raffleId, transactionId, 'failed', error.message);

                // Показуємо повідомлення про помилку
                if (typeof window.showToast === 'function') {
                    window.showToast(error.message || "Помилка при спробі участі в розіграші", 'error');
                }

                // Перевірка на завершення розіграшу
                if (error.message &&
                   (error.message.includes('завершено') ||
                    error.message.includes('not found') ||
                    error.message.includes('не знайдено'))) {

                    this.addInvalidRaffleId(raffleId);
                }

                return Promise.reject(error);
            } finally {
                // Видаляємо транзакцію з активних
                this.activeTransactions.delete(raffleId);

                // НОВЕ: Додано таймаут для кнопки, щоб запобігти повторним швидким клікам
                setTimeout(() => {
                    const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
                    buttons.forEach(button => {
                        if (button.classList.contains('processing')) {
                            this._resetButtonState(raffleId);
                        }
                    });
                }, 3000);
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
         * Перевірка валідності UUID
         * @param {string} id - UUID для перевірки
         * @returns {boolean} - Результат перевірки
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

            // НОВЕ: Скидаємо прапорець синхронізації
            this.isSyncInProgress = false;

            // НОВЕ: Очищаємо таймер синхронізації
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

            // НОВЕ: Перевірка чи синхронізація вже виконується
            if (this.isSyncInProgress) {
                console.log('⏳ Синхронізація вже виконується, пропускаємо дублікат');
                return false;
            }

            this.isSyncInProgress = true;

            try {
                // Скидаємо всі активні транзакції
                this.activeTransactions.clear();

                // Завантажуємо актуальні дані про участь користувача
                await this.loadUserRaffles(true);

                // Оновлюємо баланс користувача
                if (window.WinixAPI && typeof window.WinixAPI.getBalance === 'function') {
                    try {
                        const balanceResponse = await window.WinixAPI.getBalance();

                        if (balanceResponse.status === 'success' && balanceResponse.data) {
                            // Оновлюємо відображення жетонів
                            const userCoinsElement = document.getElementById('user-coins');
                            if (userCoinsElement && typeof balanceResponse.data.coins !== 'undefined') {
                                userCoinsElement.textContent = balanceResponse.data.coins;

                                // Оновлюємо кеш
                                localStorage.setItem('userCoins', balanceResponse.data.coins.toString());
                                localStorage.setItem('winix_coins', balanceResponse.data.coins.toString());
                            }
                        }
                    } catch (error) {
                        console.warn('⚠️ Помилка оновлення балансу:', error);
                    }
                }

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
                lastRequestTimes: this.lastRequestTimes,
                transactionLog: this.transactionLog,
                lastSyncTime: this.lastSyncTime,
                syncCounter: this.syncCounter,
                isSyncInProgress: this.isSyncInProgress
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

        if (participation && participation.activeTransactions.size > 0) {
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
        if (participation && participation.activeTransactions.size > 0) {
            console.warn('⚠️ Виявлено необроблену Promise помилку. Скидаємо стан...');
            participation.resetState();
        }
    });

    console.log('✅ Модуль участі успішно ініціалізовано');
})();