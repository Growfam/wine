/**
 * WINIX - Система розіграшів (participation.js)
 * Оптимізований та виправлений модуль для обробки участі користувача в розіграшах
 * Виправлено проблеми з умовами гонки, списанням жетонів та обробкою помилок
 * @version 3.6.0
 */

(function() {
    'use strict';
// Трекер показаних сповіщень для запобігання дублюванню
const shownNotifications = new Set();
if (typeof window.showToast === 'function') {
    const originalShowToast = window.showToast;
    window.showToast = function(message, type) {
        // Створюємо унікальний ключ для повідомлення
        const messageKey = message + (type || '');

        // Перевіряємо, чи не показували це повідомлення нещодавно
        if (shownNotifications.has(messageKey)) {
            console.log(`💬 Пропущено дублікат сповіщення: ${message}`);
            return;
        }

        // Додаємо до списку показаних
        shownNotifications.add(messageKey);

        // Видаляємо зі списку через 5 секунд
        setTimeout(() => {
            shownNotifications.delete(messageKey);
        }, 5000);

        // Викликаємо оригінальну функцію
        return originalShowToast.call(this, message, type);
    };
    console.log('✅ Функцію showToast успішно патчено для дедуплікації сповіщень');
}

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
        MIN_REQUEST_INTERVAL: 2000, // 2 секунди між запитами

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

        // Прапорець для контролю стану обробки запиту
        requestInProgress: false,

        // Час останнього запиту участі
        lastParticipationTime: 0,

        // ДОДАНО: Прапорець примусової синхронізації після відправки запиту
        needsForcedSync: false,

        // ДОДАНО: Таймер для перевірки оновлення даних з сервера після запиту
        serverCheckTimer: null,

        // ДОДАНО: Кеш реальних даних з сервера для запобігання десинхронізації
        serverDataCache: {
            // Час останнього оновлення кешу
            lastUpdate: 0,
            // Розіграші, в яких користувач бере участь за даними сервера
            participatingRaffles: new Set(),
            // Кількість білетів користувача для кожного розіграшу за даними сервера
            userRaffleTickets: {}
        },

        // ДОДАНО: Прапорець блокування для запобігання race condition
        syncLock: false,

        // ДОДАНО: Прапорець для відстеження необхідності відкладеної синхронізації
        pendingSyncRequested: false,

        // ДОДАНО: Лічильник транзакцій
        transactionCounter: 0,

        /**
         * Ініціалізація модуля
         */
        init: function() {
            console.log('🎯 Ініціалізація модуля участі в розіграшах...');

            // Очищення стану перед ініціалізацією
            this._cleanupState();

            // ЗМІНЕНО: Спочатку завантажуємо дані з сервера, а потім відновлюємо з локального сховища
            // якщо сервер повернув помилку
            this.loadUserRaffles(true)
                .then(() => {
                    console.log('✅ Успішно завантажено дані про участь з сервера');
                })
                .catch(error => {
                    console.warn('⚠️ Не вдалося завантажити дані з сервера, відновлюємо з локального сховища:', error);
                    // Тепер відновлюємо з локального сховища тільки якщо сервер недоступний
                    this._restoreParticipationFromStorage();
                });

            // Запуск моніторингу стану транзакцій
            this._startTransactionMonitor();

            // Перевірка незавершених транзакцій
            this._checkPendingTransactions();

            // Налаштування механізмів синхронізації даних
            this._setupSyncMechanisms();

            // Додавання обробників подій
            this._setupEventHandlers();

            // Синхронізація з локальною базою даних
            this._syncWithIndexedDB();

            console.log('✅ Модуль участі в розіграшах успішно ініціалізовано');

            // Запускаємо періодичну перевірку стану участі
            if (!this.serverSyncInterval) {
                this.serverSyncInterval = setInterval(() => {
                    // Перевіряємо та виправляємо стан участі кожні 3 хвилини
                    if (document.visibilityState === 'visible') {
                        this.verifyAndFixParticipationState()
                            .catch(e => console.warn('Помилка перевірки стану:', e));
                    }
                }, 3 * 60 * 1000); // 3 хвилини

                console.log('🔄 Запущено періодичну перевірку та виправлення стану участі');
            }

            // ДОДАНО: Запуск додаткового таймера для перевірки стану сервера
            this._startServerCheckTimer();

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

            // ДОДАНО: Скидання таймера перевірки стану сервера
            if (this.serverCheckTimer) {
                clearInterval(this.serverCheckTimer);
                this.serverCheckTimer = null;
            }

            // Скидання прапорця синхронізації
            this.isSyncInProgress = false;

            // Скидання глобального блокування
            this.requestLock = false;

            // Скидання статусу обробки запиту
            this.requestInProgress = false;

            // Скидання прапорця примусової синхронізації
            this.needsForcedSync = false;

            // ДОДАНО: Скидання прапорця блокування синхронізації
            this.syncLock = false;

            // ДОДАНО: Скидання прапорця відкладеної синхронізації
            this.pendingSyncRequested = false;

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
                    // Якщо немає оригінального тексту, повертаємо стандартний
                    const isMini = button.classList.contains('mini-raffle-button');
                    const entryFee = button.getAttribute('data-entry-fee') || '1';
                    button.textContent = isMini ?
                        'Взяти участь' :
                        `Взяти участь за ${entryFee} жетон${parseInt(entryFee) > 1 ? 'и' : ''}`;
                }
            });
        },

        /**
         * Очищення всіх кешів та даних участі
         * Використовується для примусового оновлення стану
         * @private
         */
        _clearAllCaches: function() {
            console.log('🧹 Очищення всіх кешів та даних участі...');

            // Очищаємо локальні структури даних
            this.participatingRaffles.clear();
            this.userRaffleTickets = {};
            this.invalidRaffleIds.clear();

            // Очищаємо кеш серверних даних
            this.serverDataCache.participatingRaffles.clear();
            this.serverDataCache.userRaffleTickets = {};
            this.serverDataCache.lastUpdate = 0;

            // Очищаємо дані в localStorage, пов'язані з участю
            try {
                localStorage.removeItem('winix_participation_state');

                // Знаходимо всі ключі, пов'язані з підтвердженою участю
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (
                        key.startsWith('winix_confirmed_participation_') ||
                        key === 'winix_last_transaction' ||
                        key === 'winix_pending_transactions' ||
                        key === 'winix_invalid_raffles' ||
                        key === 'winix_user_tickets'
                    )) {
                        keysToRemove.push(key);
                    }
                }

                // Видаляємо всі знайдені ключі
                keysToRemove.forEach(key => {
                    localStorage.removeItem(key);
                    console.log(`🧹 Видалено кеш: ${key}`);
                });
            } catch (e) {
                console.warn('⚠️ Помилка очищення локального сховища:', e);
            }

            // Встановлюємо прапорець примусової синхронізації з сервером
            this.needsForcedSync = true;

            console.log('✅ Всі кеші та дані участі очищено');
        },

        /**
         * Запуск таймера для перевірки стану сервера
         * @private
         */
        _startServerCheckTimer: function() {
            // Скидаємо таймер, якщо він є
            if (this.serverCheckTimer) {
                clearInterval(this.serverCheckTimer);
            }

            // Запускаємо новий таймер
            this.serverCheckTimer = setInterval(() => {
                // Виконуємо, тільки якщо сторінка активна
                if (document.visibilityState === 'visible') {
                    // Перевіряємо, чи потрібна синхронізація
                    const now = Date.now();

                    // Синхронізуємо з сервером, якщо:
                    // 1. Встановлено прапорець примусової синхронізації
                    // 2. Або минуло більше 5 хвилин з останнього оновлення кешу
                    if (this.needsForcedSync || now - this.serverDataCache.lastUpdate > 5 * 60 * 1000) {
                        console.log('🔄 Перевірка стану сервера...');
                        this._updateServerDataCache()
                            .then(changed => {
                                if (changed) {
                                    console.log('📊 Виявлено зміни на сервері, оновлюємо інтерфейс');
                                    this.updateParticipationButtons();
                                }
                                // Скидаємо прапорець незалежно від результату
                                this.needsForcedSync = false;
                            })
                            .catch(err => {
                                console.warn('⚠️ Помилка оновлення кешу сервера:', err);
                                // Залишаємо прапорець для наступної спроби
                            });
                    }
                }
            }, 20000); // Перевіряємо кожні 20 секунд

            console.log('🔄 Запущено таймер перевірки стану сервера');
        },

        /**
         * Оновлення кешу даних сервера
         * @returns {Promise<boolean>} true, якщо дані змінилися
         * @private
         */
        _updateServerDataCache: async function() {
            // Запобігаємо паралельним запитам
            if (this.isSyncInProgress) {
                return false;
            }

            this.isSyncInProgress = true;

            try {
                // Отримання ID користувача
                const userId = WinixRaffles.state.telegramId ||
                              (window.WinixAPI ? window.WinixAPI.getUserId() : null);

                if (!userId) {
                    console.warn('⚠️ Не вдалося визначити ID користувача для оновлення кешу');
                    return false;
                }

                // Додаємо параметр запобігання кешуванню
                const nocache = Date.now();

                // Виконуємо запит до сервера
                const response = await WinixAPI.apiRequest(
                    `user/${userId}/raffles?nocache=${nocache}`,
                    'GET',
                    null,
                    {
                        suppressErrors: true,
                        hideLoader: true,
                        timeout: 10000,
                        allowParallel: true,
                        retries: 1
                    }
                );

                if (response && response.status === 'success' && Array.isArray(response.data)) {
                    // Зберігаємо минулий стан для порівняння
                    const prevRaffles = new Set(this.serverDataCache.participatingRaffles);
                    const prevTickets = {...this.serverDataCache.userRaffleTickets};

                    // Очищаємо дані перед оновленням
                    this.serverDataCache.participatingRaffles = new Set();
                    this.serverDataCache.userRaffleTickets = {};

                    // Заповнюємо кеш новими даними
                    response.data.forEach(raffle => {
                        if (raffle.raffle_id) {
                            this.serverDataCache.participatingRaffles.add(raffle.raffle_id);
                            this.serverDataCache.userRaffleTickets[raffle.raffle_id] = raffle.entry_count || 1;
                        }
                    });

                    // Оновлюємо час останнього оновлення
                    this.serverDataCache.lastUpdate = Date.now();

                    // Перевіряємо, чи дані змінилися
                    let hasChanges = false;

                    // Перевіряємо нові розіграші
                    for (const raffleId of this.serverDataCache.participatingRaffles) {
                        if (!prevRaffles.has(raffleId) ||
                            this.serverDataCache.userRaffleTickets[raffleId] !== prevTickets[raffleId]) {
                            hasChanges = true;
                            break;
                        }
                    }

                    // Перевіряємо видалені розіграші
                    if (!hasChanges) {
                        for (const raffleId of prevRaffles) {
                            if (!this.serverDataCache.participatingRaffles.has(raffleId)) {
                                hasChanges = true;
                                break;
                            }
                        }
                    }

                    // Якщо є зміни, оновлюємо локальний стан
                    if (hasChanges) {
                        console.log('🔄 Виявлено розбіжності з сервером, оновлюємо дані участі');

                        // Оновлюємо дані участі
                        this.participatingRaffles = new Set(this.serverDataCache.participatingRaffles);
                        this.userRaffleTickets = {...this.serverDataCache.userRaffleTickets};

                        // Зберігаємо оновлені дані
                        this._saveParticipationToStorage();

                        return true;
                    }

                    return false;
                }

                return false;
            } catch (error) {
                console.error('❌ Помилка оновлення кешу сервера:', error);
                return false;
            } finally {
                this.isSyncInProgress = false;
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

                // Перевірка зависаючого стану requestInProgress
                if (this.requestInProgress) {
                    const timeSinceLastRequest = now - this.lastParticipationTime;
                    if (timeSinceLastRequest > 15000) { // 15 секунд
                        console.warn('⚠️ Виявлено активний стан requestInProgress більше 15 секунд. Скидаємо стан.');
                        this.requestInProgress = false;

                        // Відновлюємо всі кнопки в стані обробки
                        document.querySelectorAll('.join-button.processing, .mini-raffle-button.processing').forEach(button => {
                            const raffleId = button.getAttribute('data-raffle-id');
                            if (raffleId) {
                                this._resetButtonState(raffleId);
                            }
                        });

                        // Ховаємо індикатор завантаження
                        if (typeof window.hideLoading === 'function') {
                            window.hideLoading();
                        }
                    }
                }

                // ДОДАНО: Перевірка необхідності відкладеної синхронізації
                if (this.pendingSyncRequested && !this.isSyncInProgress && !this.syncLock) {
                    this.pendingSyncRequested = false;
                    this.syncWithServer(false).catch(err => {
                        console.warn('⚠️ Помилка відкладеної синхронізації:', err);
                    });
                }

                // ДОДАНО: Перевірка необхідності примусової синхронізації
                if (this.needsForcedSync && !this.isSyncInProgress && !this.syncLock) {
                    if (now - this.lastSyncTime > 5000) { // Якщо минуло більше 5 секунд з останньої синхронізації
                        this._updateServerDataCache().catch(err => {
                            console.warn('⚠️ Помилка примусової синхронізації:', err);
                        });
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

                    // Перевірка зависаючого стану requestInProgress
                    if (this.requestInProgress && (now - this.lastParticipationTime > 10000)) {
                        console.warn('⚠️ Виявлено активний стан requestInProgress після повернення на сторінку. Скидаємо стан.');
                        this.requestInProgress = false;
                        hasStaleRequests = true;
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

                    // Скидаємо статус обробки запиту
                    this.requestInProgress = false;

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
            // Перевіряємо наявність останньої транзакції перед запитом
            const lastTxData = localStorage.getItem('winix_last_transaction');
            let lastTx = null;

            if (lastTxData) {
                try {
                    lastTx = JSON.parse(lastTxData);
                    // Перевіряємо, чи транзакція досить нова (менше 2 хвилин)
                    const txAge = Date.now() - lastTx.timestamp;
                    if (txAge < 120000) {
                        console.log('📝 Знайдено недавню транзакцію:',
                            lastTx.type, 'баланс:', lastTx.newBalance,
                            'вік:', Math.round(txAge/1000) + 'с');
                    }
                } catch (e) {
                    console.warn('⚠️ Помилка парсингу даних транзакції:', e);
                }
            }

            // Запит балансу з сервера
            const response = await window.WinixAPI.getBalance();

            if (response && response.status === 'success' && response.data) {
                let newBalance = response.data.coins;
                const oldBalance = parseInt(localStorage.getItem('userCoins') || '0');
                let shouldUpdate = true;

                // Запам'ятовуємо баланс від сервера
                this.lastKnownBalance = newBalance;
                this.lastBalanceUpdateTime = Date.now();

                console.log(`📊 Отримано баланс з сервера: ${newBalance} жетонів`);

                // Перевірка на конфлікт з недавньою транзакцією
                if (lastTx && lastTx.confirmed && lastTx.type === 'participation') {
                    const txAge = Date.now() - lastTx.timestamp;

                    // Якщо транзакція відбулась менше 2 хвилин тому і баланс сервера не відповідає локальному
                    if (txAge < 120000 && newBalance !== lastTx.newBalance) {
                        console.warn(`⚠️ Виявлено конфлікт балансу після недавньої транзакції:
                            - Локальна транзакція (${Math.round(txAge/1000)}с тому): ${lastTx.newBalance} жетонів
                            - Сервер повернув: ${newBalance} жетонів`);

                        // Якщо транзакція дуже нова (менше 60 секунд), довіряємо їй більше
                        if (txAge < 60000) {
                            console.log(`🛡️ Використовуємо локальний баланс замість серверного`);
                            shouldUpdate = false; // Не оновлюємо дані з сервера

                            // Повертаємо локальний баланс як актуальний
                            newBalance = lastTx.newBalance;
                        }
                    }
                }

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
                localStorage.setItem('winix_server_balance', newBalance.toString());

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
                // Спочатку перевіряємо, чи є свіжі дані про транзакції
                const lastTxData = localStorage.getItem('winix_last_transaction');
                let prioritizeServerData = false;

                if (lastTxData) {
                    try {
                        const lastTx = JSON.parse(lastTxData);
                        const txAge = Date.now() - lastTx.timestamp;
                        // Якщо транзакція старша за 10 хвилин, пріоритет віддаємо серверу
                        if (txAge > 10 * 60 * 1000) {
                            prioritizeServerData = true;
                            console.log('📊 Пріоритет віддано серверним даним через вік транзакції');
                        }
                    } catch (e) {
                        console.warn('⚠️ Помилка обробки даних останньої транзакції:', e);
                    }
                }

                // Відновлення даних участі - тепер зі ЗНИЖЕНИМ пріоритетом
                // для уникнення заміщення серверних даних
                if (!prioritizeServerData) {
                    const savedState = localStorage.getItem('winix_participation_state');
                    if (savedState) {
                        const parsedState = JSON.parse(savedState);

                        // Перевірка актуальності даних (не старіші 10 хвилин - ЗМЕНШЕНО з 30 хвилин)
                        if (parsedState && parsedState.lastUpdate) {
                            const now = Date.now();
                            const cacheAge = now - parsedState.lastUpdate;

                            if (cacheAge < 10 * 60 * 1000) { // 10 хвилин замість 30
                                // Відновлюємо список розіграшів з участю
                                if (Array.isArray(parsedState.raffles)) {
                                    this.participatingRaffles = new Set(parsedState.raffles);
                                }

                                // Відновлюємо кількість білетів
                                if (parsedState.tickets) {
                                    this.userRaffleTickets = parsedState.tickets;
                                }

                                // ДОДАНО: Відновлюємо баланс
                                if (parsedState.balance !== undefined) {
                                    this.lastKnownBalance = parsedState.balance;
                                    this.lastBalanceUpdateTime = parsedState.lastBalanceUpdateTime || now;
                                }

                                console.log('✅ Успішно відновлено дані про участь із локального сховища');

                                // ДОДАНО: Встановлюємо прапорець для примусової перевірки з сервером
                                this.needsForcedSync = true;
                            } else {
                                console.log('ℹ️ Кеш участі застарів, виконується очищення');
                                localStorage.removeItem('winix_participation_state');
                            }
                        }
                    }
                } else {
                    console.log('🔄 Пропускаємо відновлення з локального сховища для отримання свіжих даних з сервера');
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

                // ДОДАНО: Встановлюємо прапорець для примусової синхронізації з сервером
                this.needsForcedSync = true;
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
                    lastUpdate: Date.now(),
                    balance: this.lastKnownBalance,
                    lastBalanceUpdateTime: this.lastBalanceUpdateTime
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
        _setupEventHandlers: function() {
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

                    // Перевірка стану обробки запиту
                    if (this.requestInProgress) {
                        if (typeof window.showToast === 'function') {
                            window.showToast('Зачекайте завершення попереднього запиту', 'warning');
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

                    // ВИПРАВЛЕНО: Спочатку перевіряємо достатність жетонів
                    const entryFee = parseInt(participateButton.getAttribute('data-entry-fee') || '1');
                    const userCoins = this._getCurrentCoins();

                    if (userCoins < entryFee) {
                        // Відновлюємо стан кнопки
                        this._resetButtonState(raffleId);

                        // Показуємо повідомлення про недостатність жетонів
                        if (typeof window.showToast === 'function') {
                            window.showToast(`Недостатньо жетонів. Потрібно: ${entryFee}, у вас: ${userCoins}`, 'warning');
                        }
                        return;
                    }

                    // Запускаємо участь у розіграші
                    this.participateInRaffle(raffleId, raffleType)
                        .then(result => {
                            if (result.success) {
                                // Кнопка буде оновлена через updateParticipationButtons
                                console.log(`✅ Успішна участь у розіграші ${raffleId}`);
                            } else {
                                console.warn(`⚠️ Помилка участі: ${result.message}`);

                                // Відновлюємо стан кнопки
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

            // Обробник події оновлення даних користувача
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

                    // ДОДАНО: Встановлюємо прапорець для пізнішої синхронізації з сервером
                    this.needsForcedSync = true;

                    // Планування додаткової синхронізації для перевірки
                    setTimeout(() => {
                        this.loadUserRaffles(true);
                    }, 3000);
                }
            });
        },

        /**
         * Отримання поточної кількості жетонів
         * @private
         * @returns {number} Кількість жетонів
         */
        _getCurrentCoins: function() {
            // Спочатку перевіряємо DOM
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                return parseInt(userCoinsElement.textContent) || 0;
            }

            // Потім перевіряємо кеш
            if (this.lastKnownBalance !== null) {
                return this.lastKnownBalance;
            }

            // Нарешті перевіряємо localStorage
            return parseInt(localStorage.getItem('userCoins') ||
                            localStorage.getItem('winix_coins')) || 0;
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
                button.disabled = false;

                // Перевіряємо участь у розіграші через модуль participation
                const isParticipating = this.participatingRaffles.has(raffleId);

                if (isParticipating) {
                    // Якщо користувач уже бере участь, відображаємо відповідний стан
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
         * Оновлення статусу транзакції в localStorage
         * @param {string} raffleId - ID розіграшу
         * @param {string} transactionId - ID транзакції
         * @param {string} status - Новий статус транзакції
         * @param {string} [message] - Повідомлення про помилку (опціонально)
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
         * @returns {Promise<Object>} Результат завантаження
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

                // ВИПРАВЛЕНО: Додаємо параметр запобігання кешуванню для гарантованого отримання свіжих даних
                const nocache = now;

                // Запит до API з додатковими опціями для надійності
                const response = await WinixAPI.apiRequest(`user/${userId}/raffles?nocache=${nocache}`, 'GET', null, {
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

                    // ВИПРАВЛЕНО: Перевірка локальних даних на пріоритетність
                    // Якщо кількість білетів у нас більша, ніж у відповіді, зберігаємо наші дані
                    Array.from(this.participatingRaffles).forEach(raffleId => {
                        if (newParticipating.has(raffleId)) {
                            const localTickets = this.userRaffleTickets[raffleId] || 0;
                            const serverTickets = newTickets[raffleId] || 0;

                            // Якщо локальні дані новіші (більше білетів), зберігаємо наше значення
                            if (localTickets > serverTickets) {
                                console.log(`🔍 Виявлено розбіжність в кількості білетів для розіграшу ${raffleId}: локально ${localTickets}, на сервері ${serverTickets}. Зберігаємо локальне значення.`);
                                newTickets[raffleId] = localTickets;
                                hasChanges = true;

                                // Встановлюємо прапорець примусової синхронізації, щоб пізніше перевірити
                                this.needsForcedSync = true;
                            }
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
                            this.userRaffleTickets[raffle.raffle_id] = newTickets[raffle.raffle_id] || raffle.entry_count || 1;
                        }
                    });

                    // ДОДАНО: Оновлюємо кеш серверних даних
                    this.serverDataCache.participatingRaffles = new Set(this.participatingRaffles);
                    this.serverDataCache.userRaffleTickets = {...this.userRaffleTickets};
                    this.serverDataCache.lastUpdate = now;

                    // Скидаємо прапорець примусової синхронізації, так як дані оновлено
                    this.needsForcedSync = false;

                    console.log(`✅ Користувач бере участь у ${this.participatingRaffles.size} розіграшах (синхронізація #${syncId})`);

                    // Якщо були зміни, логуємо їх
                    if (hasChanges) {
                        console.log('🔄 Виявлено зміни в участі користувача під час синхронізації #' + syncId);
                    }

                    // Зберігаємо дані в localStorage
                    this._saveParticipationToStorage();

                    // Оновлюємо час останньої синхронізації
                    this.lastSyncTime = now;

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
                console.log('🔄 Оновлення кнопок участі...');

                // НОВИЙ КОД: Відновлення з підтверджених даних участі
                try {
                    // Збираємо всі записи про підтверджену участь
                    const storageKeys = Object.keys(localStorage);
                    const participationKeys = storageKeys.filter(key => key.startsWith('winix_confirmed_participation_'));

                    if (participationKeys.length > 0) {
                        console.log(`📋 Знайдено ${participationKeys.length} записів про підтверджену участь`);

                        participationKeys.forEach(key => {
                            try {
                                const data = JSON.parse(localStorage.getItem(key));
                                const raffleId = data.raffleId;
                                const ticketCount = data.ticketCount || 1;
                                const age = Date.now() - data.validatedAt;

                                // Використовуємо підтверджені дані, які не старіші 30 хвилин
                                if (age < 30 * 60 * 1000 && raffleId) {
                                    this.participatingRaffles.add(raffleId);
                                    this.userRaffleTickets[raffleId] = ticketCount;
                                }
                            } catch (e) {
                                console.warn(`⚠️ Помилка обробки запису ${key}:`, e);
                            }
                        });
                    }
                } catch (e) {
                    console.warn('⚠️ Помилка відновлення з підтверджених даних:', e);
                }

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

                // НОВИЙ КОД: Перевіряємо недавні транзакції
                try {
                    const lastTxData = localStorage.getItem('winix_last_transaction');
                    if (lastTxData) {
                        const lastTx = JSON.parse(lastTxData);
                        const txAge = Date.now() - lastTx.timestamp;

                        // Для транзакцій молодших за 3 хвилини, додаємо розіграш у список участі
                        if (txAge < 180000 && lastTx.confirmed && lastTx.type === 'participation' && lastTx.raffleId) {
                            console.log(`📝 Застосовуємо дані транзакції для розіграшу ${lastTx.raffleId} (${Math.round(txAge/1000)}с тому)`);

                            // Додаємо розіграш, якщо він відсутній
                            this.participatingRaffles.add(lastTx.raffleId);

                            // Оновлюємо кількість білетів, якщо не встановлено або менша
                            const currentTickets = this.userRaffleTickets[lastTx.raffleId] || 0;
                            if (lastTx.ticketCount && lastTx.ticketCount > currentTickets) {
                                this.userRaffleTickets[lastTx.raffleId] = lastTx.ticketCount;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Помилка обробки останньої транзакції:', e);
                }

                // Отримуємо всі кнопки участі
                const buttons = document.querySelectorAll('.join-button, .mini-raffle-button');
                if (!buttons.length) return;

                // Створюємо кеш для оптимізації
                const participatingCache = {};
                this.participatingRaffles.forEach(id => {
                    participatingCache[id] = true;
                });

                const invalidCache = {};
                this.invalidRaffleIds.forEach(id => {
                    invalidCache[id] = true;
                });

                const activeRequestsCache = {};
                this.activeTransactions.forEach((value, key) => {
                    activeRequestsCache[key] = true;
                });

                // НОВИЙ КОД: Логування кількості кнопок та розіграшів для діагностики
                console.log(`🎮 Оновлення ${buttons.length} кнопок, участь у ${this.participatingRaffles.size} розіграшах`);

                // Обробляємо кожну кнопку
                buttons.forEach(button => {
                    const raffleId = button.getAttribute('data-raffle-id');
                    if (!raffleId) return;

                    // Перевіряємо, чи користувач бере участь у розіграші
                    const isParticipating = participatingCache[raffleId];

                    // Перевіряємо, чи розіграш недійсний
                    const isInvalid = invalidCache[raffleId] ||
                                     (WinixRaffles.state.invalidRaffleIds &&
                                      WinixRaffles.state.invalidRaffleIds.has(raffleId));

                    // Перевіряємо, чи кнопка в процесі обробки
                    const isProcessing = activeRequestsCache[raffleId] ||
                                        this.pendingRequests[raffleId];

                    // НОВИЙ КОД: Зберігаємо поточний стан кнопки для порівняння після оновлення
                    const wasParticipating = button.classList.contains('participating');
                    const wasDisabled = button.disabled;
                    const previousText = button.textContent;

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

                        // НОВИЙ КОД: Зміна тексту тільки якщо кількість білетів змінилася
                        const newText = isMini ?
                            `Додати ще білет (${ticketCount})` :
                            `Додати ще білет (у вас: ${ticketCount})`;

                        if (!wasParticipating || previousText !== newText) {
                            button.textContent = newText;

                            // НОВИЙ КОД: Додаємо анімацію при зміні кількості білетів
                            if (wasParticipating && previousText !== newText) {
                                button.classList.add('ticket-updated');
                                setTimeout(() => button.classList.remove('ticket-updated'), 1000);
                            }
                        }

                        button.classList.add('participating');
                        button.classList.remove('processing');
                        button.disabled = false;

                        // НОВИЙ КОД: Зберігаємо кількість білетів у атрибуті для легкого доступу
                        button.setAttribute('data-ticket-count', ticketCount);
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

                        // Видаляємо атрибут кількості білетів
                        button.removeAttribute('data-ticket-count');
                    }

                    // НОВИЙ КОД: Логування зміни стану кнопки для діагностики
                    if (wasParticipating !== button.classList.contains('participating') ||
                        wasDisabled !== button.disabled ||
                        previousText !== button.textContent) {

                        console.log(`🔄 Кнопка ${raffleId}: ${previousText} -> ${button.textContent}`);
                    }
                });

                // НОВИЙ КОД: Додаємо стилі для анімації оновлення кількості білетів
                if (!document.getElementById('ticket-update-animation')) {
                    const style = document.createElement('style');
                    style.id = 'ticket-update-animation';
                    style.textContent = `
                        @keyframes ticket-highlight {
                            0% { transform: scale(1); background-color: inherit; }
                            50% { transform: scale(1.05); background-color: rgba(76, 175, 80, 0.3); }
                            100% { transform: scale(1); background-color: inherit; }
                        }
                        
                        .ticket-updated {
                            animation: ticket-highlight 0.8s ease-out;
                        }
                    `;
                    document.head.appendChild(style);
                }
            } catch (error) {
                console.error("❌ Помилка при оновленні кнопок участі:", error);
            }
        },


        /**
         * Участь у розіграші
         * @param {string} raffleId - ID розіграшу
         * @param {string} raffleType - Тип розіграшу (daily/main)
         * @param {number} entryCount - Кількість білетів
         * @returns {Promise<Object>} - Результат участі
         */
        participateInRaffle: async function(raffleId, raffleType, entryCount = 1) {
            // ВИПРАВЛЕНО: Завжди встановлюємо час запиту на початку
            const requestStartTime = Date.now();
            this.lastParticipationTime = requestStartTime;

            console.log(`🎯 Спроба участі у розіграші ${raffleId}, кількість: ${entryCount}`);

            // 1. ВАЛІДАЦІЯ ПАРАМЕТРІВ
            if (!raffleId) {
                console.error('❌ Не вказано ID розіграшу');
                return Promise.reject(new Error('Не вказано ID розіграшу'));
            }

            if (!window.isValidUUID(raffleId)) {
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

            // ВИПРАВЛЕНО: Перевірка на активний запит
            if (this.requestInProgress) {
                // Якщо запит висить більше 15 секунд, скидаємо блокування
                if (requestStartTime - this.lastParticipationTime > 15000) {
                    console.warn("⚠️ Виявлено застряглий запит, скидаємо блокування");
                    this.requestInProgress = false;
                } else {
                    console.warn("⚠️ Запит уже в процесі, зачекайте його завершення");
                    return {
                        success: false,
                        message: 'Зачекайте завершення попереднього запиту'
                    };
                }
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

            // ВИПРАВЛЕНО: Отримуємо доступний баланс перед запитом через нову функцію
            const coinsBalance = this._getCurrentCoins();

            // ВИПРАВЛЕНО: Отримуємо вартість участі
            let entryFee = 1;
            try {
                // Спробуємо отримати з кнопки
                const button = document.querySelector(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
                if (button) {
                    entryFee = parseInt(button.getAttribute('data-entry-fee') || '1');
                }
            } catch (e) {
                console.warn('⚠️ Не вдалося отримати вартість участі:', e);
            }

            // ВИПРАВЛЕНО: Перевірка на достатність жетонів перед списанням
            if (coinsBalance < entryFee) {
                return {
                    success: false,
                    message: `Недостатньо жетонів. Потрібно: ${entryFee}, у вас: ${coinsBalance}`
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

            // ВИПРАВЛЕНО: Встановлюємо глобальний прапорець обробки запиту
            this.requestInProgress = true;

            // ДОДАНО: Встановлюємо об'єкт активної транзакції
            this.activeTransactions.set(raffleId, {
                id: transactionId,
                timestamp: now,
                status: 'pending',
                raffleType: raffleType,
                entryCount: entryCount
            });

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

                // ВИПРАВЛЕНО: Перевірка на участь у розіграші
                const alreadyParticipating = this.participatingRaffles && this.participatingRaffles.has(raffleId);

                // ВИПРАВЛЕНО: Отримуємо поточну кількість білетів
                const currentTickets = (this.userRaffleTickets && this.userRaffleTickets[raffleId]) || 0;

                // 14. БУДУЄМО ЗАПИТ З ДОДАТКОВИМИ ПАРАМЕТРАМИ ДЛЯ ЗАПОБІГАННЯ ДУБЛЮВАННЯ
                const requestData = {
                    raffle_id: raffleId,
                    entry_count: entryCount,
                    _transaction_id: transactionId,
                    _timestamp: now,
                    _client_id: `${userId}_${now}_${Math.random().toString(36).substring(2, 7)}`,
                    _current_tickets: currentTickets, // Передаємо поточну кількість білетів
                    _already_participating: alreadyParticipating, // Передаємо інформацію про участь
                    _current_balance: coinsBalance // Передаємо поточний баланс
                };

                // 15. ВИКОНУЄМО ЗАПИТ ДО СЕРВЕРА
                const endpoint = `user/${userId}/participate-raffle`;
                console.log(`📡 Відправка запиту на участь (T:${transactionId.split('_')[1]})`);

                // ВСТАНОВЛЮЄМО ТАЙМАУТ ДЛЯ АВТОМАТИЧНОГО СКИДАННЯ БЛОКУВАННЯ
                const timeoutId = setTimeout(() => {
                    console.warn(`⚠️ Таймаут запиту для розіграшу ${raffleId}`);
                    delete this.pendingRequests[raffleId];
                    this.activeTransactions.delete(raffleId);
                    this._resetButtonState(raffleId);

                    // ВИПРАВЛЕНО: Скидаємо прапорець обробки запиту при таймауті
                    this.requestInProgress = false;
                }, 15000);

                // ВИПРАВЛЕНО: Додаємо додаткові опції запиту для надійності
                const requestOptions = {
                    timeout: 15000,
                    retries: 1,
                    bypassThrottle: true,
                    allowParallel: false,
                    headers: {
                        'X-Transaction-ID': transactionId,
                        'X-Client-Timestamp': now.toString()
                    }
                };

                const response = await WinixAPI.apiRequest(endpoint, 'POST', requestData, requestOptions);

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

                    // ВИЗНАЧАЄМО КІЛЬКІСТЬ БІЛЕТІВ З ДАНИХ СЕРВЕРА
                    let newTicketCount = 1;
                    if (response.data && typeof response.data.total_entries === 'number') {
                        newTicketCount = response.data.total_entries;
                    } else {
                        // Якщо сервер не повернув дані, робимо локальне обчислення
                        const currentTickets = this.userRaffleTickets[raffleId] || 0;
                        newTicketCount = currentTickets + 1;
                    }

                    // НЕГАЙНО ОНОВЛЮЄМО ЛОКАЛЬНІ ДАНІ
                    this.participatingRaffles.add(raffleId);
                    this.userRaffleTickets[raffleId] = newTicketCount;

                   // ОНОВЛЮЄМО БАЛАНС, ЯКЩО СЕРВЕР ПОВЕРНУВ НОВЕ ЗНАЧЕННЯ
                    if (response.data && typeof response.data.new_coins_balance === 'number') {
                        // Запам'ятовуємо баланс до оновлення для виявлення змін
                        const oldBalance = parseInt(localStorage.getItem('userCoins')) || 0;
                        const newBalance = response.data.new_coins_balance;

                        // Зберігаємо дані транзакції для відстеження і вирішення конфліктів
                        const transactionRecord = {
                            type: "participation",
                            raffleId: raffleId,
                            oldBalance: oldBalance,
                            newBalance: newBalance,
                            timestamp: Date.now(),
                            confirmed: true,
                            transactionId: transactionId,
                            ticketCount: newTicketCount
                        };


                        // Зберігаємо запис про останню транзакцію з балансом
                        localStorage.setItem('winix_last_transaction', JSON.stringify(transactionRecord));

                        // КРИТИЧНО ВАЖЛИВО: НЕГАЙНО ОНОВЛЮЄМО DOM-ЕЛЕМЕНТ БАЛАНСУ
                        const userCoinsElement = document.getElementById('user-coins');
                        if (userCoinsElement) {
                            // Додаємо ефект анімації
                            userCoinsElement.classList.add('decreasing');

                            // Негайно оновлюємо текстове значення
                            userCoinsElement.textContent = newBalance;

                            setTimeout(() => {
                                userCoinsElement.classList.remove('decreasing');
                            }, 1000);
                        }

                        // Оновлюємо локальне сховище відразу
                        localStorage.setItem('userCoins', newBalance.toString());
                        localStorage.setItem('winix_coins', newBalance.toString());
                        localStorage.setItem('winix_balance_update_time', Date.now().toString());
                        localStorage.setItem('winix_server_balance', newBalance.toString()); // Додаємо запис серверного балансу

                        // Оновлюємо кеш балансу
                        this.lastKnownBalance = newBalance;
                        this.lastBalanceUpdateTime = Date.now();

                        // Генеруємо подію оновлення балансу
                        document.dispatchEvent(new CustomEvent('balance-updated', {
                            detail: {
                                oldBalance: oldBalance,
                                newBalance: newBalance,
                                source: 'participation.js',
                                transactionId: transactionId
                            }
                        }));

                        console.log(`✅ Баланс успішно оновлено: старий=${oldBalance}, новий=${newBalance}, різниця=${oldBalance-newBalance}`);

                    } else {
                        // Якщо сервер не повернув баланс, віднімаємо локально вартість участі
                        const entryFee = parseInt(localStorage.getItem('last_entry_fee') || '1');
                        const currentBalance = parseInt(localStorage.getItem('userCoins') || '0');
                        const newBalance = Math.max(0, currentBalance - entryFee);

                        // Оновлюємо DOM і локальне сховище
                        const userCoinsElement = document.getElementById('user-coins');
                        if (userCoinsElement) {
                            userCoinsElement.classList.add('decreasing');
                            userCoinsElement.textContent = newBalance;

                            setTimeout(() => {
                                userCoinsElement.classList.remove('decreasing');
                            }, 1000);
                        }

                        localStorage.setItem('userCoins', newBalance.toString());
                        localStorage.setItem('winix_coins', newBalance.toString());
                    }

                    // НЕГАЙНО ОНОВЛЮЄМО ВІДОБРАЖЕННЯ КНОПКИ
                    const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
                    buttons.forEach(button => {
                        // Видаляємо стан обробки
                        button.classList.remove('processing');
                        button.removeAttribute('data-processing');
                        button.disabled = false;

                        // Додаємо клас для учасників
                        button.classList.add('participating');

                        // Оновлюємо текст кнопки
                        const isMini = button.classList.contains('mini-raffle-button');
                        button.textContent = isMini ?
                            `Додати ще білет (${newTicketCount})` :
                            `Додати ще білет (у вас: ${newTicketCount})`;
                    });

                    // ЗБЕРІГАЄМО ОНОВЛЕНІ ДАНІ В LOCALSTORAGE
                    this._saveParticipationToStorage();

                    // ОНОВЛЮЄМО КІЛЬКІСТЬ УЧАСНИКІВ, ЯКЩО СЕРВЕР ПОВЕРНУВ НОВЕ ЗНАЧЕННЯ
                    if (response.data && typeof response.data.participants_count === 'number') {
                        const participantsCount = response.data.participants_count;
                        const participantsElements = document.querySelectorAll(
                            `.raffle-card[data-raffle-id="${raffleId}"] .participants-count .count, ` +
                            `.main-raffle[data-raffle-id="${raffleId}"] .participants-info .participants-count, ` +
                            `.main-raffle .participants-info .participants-count`
                        );

                        participantsElements.forEach(element => {
                            // Оновлюємо тільки якщо значення змінилося
                            const currentCount = parseInt(element.textContent.replace(/\s+/g, '')) || 0;
                            if (currentCount !== participantsCount) {
                                element.textContent = participantsCount;
                                element.classList.add('updated');
                                setTimeout(() => {
                                    element.classList.remove('updated');
                                }, 1000);
                            }
                        });

                        // Генеруємо подію оновлення кількості учасників
                        document.dispatchEvent(new CustomEvent('raffle-participants-updated', {
                            detail: {
                                raffleId: raffleId,
                                participantsCount: participantsCount,
                                source: 'participation.js'
                            }
                        }));
                    }

                    // ВСТАНОВЛЮЄМО ПРАПОРЕЦЬ ДЛЯ ВІДКЛАДЕНОЇ СИНХРОНІЗАЦІЇ
                    this.needsForcedSync = true;

                    // ГЕНЕРУЄМО ПОДІЮ ПРО УСПІШНУ УЧАСТЬ ДЛЯ ІНШИХ МОДУЛІВ
                    this._triggerParticipationEvent(raffleId, newTicketCount);

                    // ЗАПУСКАЄМО ВІДКЛАДЕНУ ПЕРЕВІРКУ ДЛЯ ПІДТВЕРДЖЕННЯ УЧАСТІ
                    setTimeout(() => {
                        this.confirmParticipation(raffleId).catch(e =>
                            console.warn('⚠️ Помилка підтвердження участі:', e)
                        );
                    }, 3000);

                    // ДОДАНО: Перевіряємо наявність кнопки "Деталі" і видаляємо її, якщо вона є
                    const detailsButton = document.querySelector(`.raffle-details-button[data-raffle-id="${raffleId}"]`);
                    if (detailsButton && detailsButton.parentNode) {
                        detailsButton.parentNode.removeChild(detailsButton);
                        console.log(`🔄 Видалено кнопку "Деталі" для розіграшу ${raffleId}`);
                    }

                    // НОВИЙ КОД: Створюємо окремий запис про підтверджену участь у розіграші
                    try {
                        const confirmedParticipation = {
                            raffleId: raffleId,
                            ticketCount: newTicketCount,
                            validatedAt: Date.now(),
                            source: 'transaction',
                            balanceAfter: newBalance
                        };

                        localStorage.setItem(`winix_confirmed_participation_${raffleId}`, JSON.stringify(confirmedParticipation));

                        // Додатково перевіримо що кнопка оновилася через 500мс
                        setTimeout(() => {
                            const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
                            buttons.forEach(button => {
                                const currentText = button.textContent;

                                // Перевіряємо, чи відображає кнопка правильну кількість білетів
                                if (!currentText.includes(String(newTicketCount))) {
                                    console.log(`⚠️ Виявлено розбіжність тексту кнопки: "${currentText}" не містить кількість білетів ${newTicketCount}`);

                                    // Примусово встановлюємо правильний текст
                                    const isMini = button.classList.contains('mini-raffle-button');
                                    button.textContent = isMini ?
                                        `Додати ще білет (${newTicketCount})` :
                                        `Додати ще білет (у вас: ${newTicketCount})`;

                                    button.classList.add('ticket-updated');
                                    setTimeout(() => button.classList.remove('ticket-updated'), 1000);
                                }
                            });
                        }, 500);
                    } catch (e) {
                        console.warn('⚠️ Помилка збереження підтвердженої участі:', e);
                    }

                   if (typeof window.showToast === 'function' && !shownNotifications.has(raffleId)) {
    window.showToast('Ви успішно взяли участь у розіграші', 'success');
    shownNotifications.add(raffleId);
    setTimeout(() => shownNotifications.delete(raffleId), 5000);
}

                    // ПОВЕРТАЄМО РЕЗУЛЬТАТ
                    return {
                        success: true,
                        data: response.data,
                        message: response.data?.message || 'Ви успішно взяли участь у розіграші'
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
                this.activeTransactions.delete(raffleId);

                // ВИПРАВЛЕНО: Завжди скидаємо прапорець обробки запиту
                this.requestInProgress = false;

                // 21.2 ПРИХОВУЄМО ІНДИКАТОР ЗАВАНТАЖЕННЯ
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                // ДОДАНО: Відкладена перевірка стану через 5 секунд
                // щоб дати час серверу оновити дані
                setTimeout(() => {
                    if (this.needsForcedSync && !this.isSyncInProgress && !this.syncLock) {
                        this.syncWithServer(true).catch(e => {
                            console.warn('⚠️ Помилка відкладеної синхронізації:', e);
                        });
                    }
                }, 5000);
            }
        },

        /**
         * Підтвердження участі в розіграші
         * Використовується для додаткової перевірки після успішної участі
         */
        confirmParticipation: async function(raffleId) {
            if (!raffleId) return;

            console.log(`🔍 Підтвердження участі в розіграші ${raffleId}`);

            // Додаємо таймстамп до запиту для уникнення кешування
            const timestamp = Date.now();

            try {
                // Отримуємо ID користувача
                const userId = WinixRaffles.state.telegramId ||
                            (window.WinixAPI ? window.WinixAPI.getUserId() : null);

                if (!userId) {
                    console.warn('⚠️ Не вдалося визначити ID користувача для підтвердження');
                    return;
                }

                // Зберігаємо поточні дані для порівняння
                const currentParticipation = this.participatingRaffles.has(raffleId);
                const currentTickets = this.userRaffleTickets[raffleId] || 0;

                // Спробуємо виконати запит до 3-х разів при помилках мережі
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        // Додаємо nocache-параметр для уникнення кешування
                        const response = await WinixAPI.apiRequest(`user/${userId}/raffles?nocache=${timestamp}`, 'GET', null, {
                            suppressErrors: true,
                            hideLoader: true,
                            timeout: 10000,
                            retries: 1
                        });

                        if (response && response.status === 'success' && Array.isArray(response.data)) {
                            // Шукаємо розіграш у відповіді
                            const foundRaffle = response.data.find(r => r.raffle_id === raffleId);

                            if (foundRaffle) {
                                console.log(`✅ Підтверджено участь у розіграші ${raffleId}, білетів: ${foundRaffle.entry_count || 1}`);

                                // КРИТИЧНО ВАЖЛИВО: Оновлюємо локальні дані
                                this.participatingRaffles.add(raffleId);
                                this.userRaffleTickets[raffleId] = foundRaffle.entry_count || 1;

                                // Оновлюємо кеш серверних даних
                                this.serverDataCache.participatingRaffles.add(raffleId);
                                this.serverDataCache.userRaffleTickets[raffleId] = foundRaffle.entry_count || 1;
                                this.serverDataCache.lastUpdate = Date.now();

                                // Записуємо в локальне сховище
                                this._saveParticipationToStorage();

                                // НОВИЙ КОД: Зберігаємо гарантовану копію стану участі в локальне сховище
                                try {
                                    const validatedParticipation = {
                                        raffleId: raffleId,
                                        ticketCount: foundRaffle.entry_count || 1,
                                        validatedAt: Date.now(),
                                        source: 'server'
                                    };

                                    localStorage.setItem(`winix_confirmed_participation_${raffleId}`, JSON.stringify(validatedParticipation));
                                } catch (e) {
                                    console.warn('⚠️ Помилка збереження підтвердженої участі:', e);
                                }

                                // Гарантуємо оновлення інтерфейсу
                                this.updateParticipationButtons();
                                return true;
                            } else {
                                console.warn(`⚠️ Розіграш ${raffleId} не знайдено у відповіді сервера`);

                                // НОВИЙ КОД: Перевіряємо, чи вважаємо ми локально, що участь є
                                if (currentParticipation && currentTickets > 0) {
                                    console.warn(`⚠️ Виявлено розбіжність: локально участь встановлена, сервер показує відсутність`);

                                    // НОВИЙ КОД: Якщо у нас є запис про транзакцію, і вона недавня
                                    try {
                                        const lastTxData = localStorage.getItem('winix_last_transaction');
                                        if (lastTxData) {
                                            const lastTx = JSON.parse(lastTxData);
                                            const txAge = Date.now() - lastTx.timestamp;

                                            // Для дуже нових транзакцій (менше 1 хвилини) довіряємо локальним даним
                                            if (txAge < 60000 && lastTx.raffleId === raffleId && lastTx.confirmed) {
                                                console.log(`🛡️ Зберігаємо локальну участь, незважаючи на відповідь сервера (транзакція ${Math.round(txAge/1000)}с тому)`);
                                                return false; // Не змінюємо стан участі
                                            }
                                        }
                                    } catch (e) {
                                        console.warn('⚠️ Помилка перевірки даних транзакції:', e);
                                    }
                                }

                                // Якщо розіграш не знайдено, і немає причин зберігати локальний стан, видаляємо участь
                                this.participatingRaffles.delete(raffleId);
                                delete this.userRaffleTickets[raffleId];
                                this._saveParticipationToStorage();
                                this.updateParticipationButtons();
                                return false;
                            }
                        } else {
                            console.warn('⚠️ Не вдалося отримати дані для підтвердження участі');

                            // Якщо спроба не остання, повторюємо
                            if (attempt < 2) {
                                console.log(`Повторна спроба ${attempt + 1}/3...`);
                                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                                continue;
                            }

                            // НОВИЙ КОД: При помилці синхронізації зберігаємо локальний стан
                            console.log('⚠️ Зберігаємо локальний стан участі через помилку синхронізації');
                            return false;
                        }
                    } catch (error) {
                        console.warn('⚠️ Помилка підтвердження участі:', error);

                        // Якщо спроба не остання, повторюємо
                        if (attempt < 2) {
                            console.log(`Повторна спроба ${attempt + 1}/3...`);
                            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                            continue;
                        }
                    }
                }

                // Якщо всі спроби не вдалися, збережемо локальний стан
                return false;
            } catch (error) {
                console.warn('⚠️ Критична помилка підтвердження участі:', error);
                return false;
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

                // ВИПРАВЛЕНО: Додаємо параметр запобігання кешуванню
                const nocache = Date.now();

                // Отримуємо актуальні дані з сервера
                const response = await WinixAPI.apiRequest(`user/${userId}/raffles?nocache=${nocache}`, 'GET', null, {
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

                        // Оновлюємо кеш серверних даних
                        this.serverDataCache.participatingRaffles = new Set(this.participatingRaffles);
                        this.serverDataCache.userRaffleTickets = {...this.userRaffleTickets};
                        this.serverDataCache.lastUpdate = Date.now();

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
 * Очищення списку невалідних розіграшів
 */
clearInvalidRaffleIds: function() {
    this.invalidRaffleIds.clear();

    if (WinixRaffles.state.invalidRaffleIds) {
        WinixRaffles.state.invalidRaffleIds.clear();
    }

    localStorage.removeItem('winix_invalid_raffles');
    console.log('🧹 Список недійсних розіграшів очищено');
},

/**
 * Синхронізація з сервером
 * @param {boolean} force - Примусова синхронізація
 * @returns {Promise<Object>} Результат синхронізації
 */
syncWithServer: async function(force = false) {
    // ДОДАНО: Перевірка, чи синхронізація не заблокована
    if (this.syncLock && !force) {
        console.log('🔒 Синхронізація заблокована, встановлюємо прапорець відкладеної синхронізації');
        this.pendingSyncRequested = true;
        return Promise.resolve({ success: false, message: "Синхронізація заблокована" });
    }

    // ДОДАНО: Блокування синхронізації на час виконання
    this.syncLock = true;

    try {
        console.log('🔄 Початок синхронізації з сервером...');

        // Перевіряємо наявність модуля участі
        if (!window.WinixRaffles || !window.WinixRaffles.participation) {
            console.warn('⚠️ Модуль участі недоступний');
            return false;
        }

        // Використовуємо метод завантаження з примусовим оновленням
        await this.loadUserRaffles(true);

        // Оновлюємо час синхронізації
        this.lastSyncTime = Date.now();

        // Оновлюємо відображення кнопок участі
        this.updateParticipationButtons();

        // Також оновлюємо баланс
        await this._getServerBalance();

        // Скидаємо прапорець примусової синхронізації
        this.needsForcedSync = false;

        console.log('✅ Дані про участь успішно синхронізовано');
        return true;
    } catch (error) {
        console.error('❌ Помилка синхронізації з сервером:', error);
        return false;
    } finally {
        // ДОДАНО: Знімаємо блокування синхронізації
        this.syncLock = false;

        // ДОДАНО: Якщо є відкладена синхронізація та немає блокування, запускаємо її
        if (this.pendingSyncRequested && !this.isSyncInProgress) {
            setTimeout(() => {
                if (this.pendingSyncRequested) {
                    this.pendingSyncRequested = false;
                    this.syncWithServer(false).catch(e => {
                        console.warn('⚠️ Помилка відкладеної синхронізації:', e);
                    });
                }
            }, 2000);
        }
    }
},

/**
 * Скидання стану модуля
 * @returns {boolean} Результат скидання
 */
resetState: function() {
    console.log('🔄 Виконується скидання стану модуля участі...');

    // Скидаємо всі активні транзакції
    this.activeTransactions.clear();

    // Скидаємо глобальне блокування
    this.requestLock = false;

    // ВИПРАВЛЕНО: Скидаємо прапорець обробки запиту
    this.requestInProgress = false;

    // Очищення обмежень розіграшів
    this.pendingRequests = {};

    // Скидаємо часові мітки запитів
    this.lastRequestTimes = {};

    // Скидаємо прапорець примусової синхронізації
    this.needsForcedSync = false;

    // ДОДАНО: Скидаємо прапорець блокування синхронізації
    this.syncLock = false;

    // ДОДАНО: Скидаємо прапорець відкладеної синхронізації
    this.pendingSyncRequested = false;

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
        // ДОДАНО: Стан обробки запиту
        requestInProgress: this.requestInProgress,
        lastParticipationTime: this.lastParticipationTime,
        totalRequestCount: this.totalRequestCount,
        localOperations: this.localOperations.slice(0, 10), // Останні 10 операцій
        lastBalanceUpdateTime: this.lastBalanceUpdateTime,
        lastKnownBalance: this.lastKnownBalance,
        // ДОДАНО: Інформація про кеш даних сервера
        serverDataCache: {
            lastUpdate: this.serverDataCache.lastUpdate,
            rafflesCount: this.serverDataCache.participatingRaffles.size,
            needsForcedSync: this.needsForcedSync
        },
        // ДОДАНО: Статус блокування синхронізації
        syncLock: this.syncLock,
        pendingSyncRequested: this.pendingSyncRequested
    };
}
};

// Додаємо модуль до головного модуля розіграшів
window.WinixRaffles.participation = participation;

// Ініціалізація модуля при завантаженні сторінки
document.addEventListener('DOMContentLoaded', function() {
    if (window.WinixRaffles.state.isInitialized) {
        participation.init();
    } else {
        // Додаємо обробник події ініціалізації
        document.addEventListener('winix-raffles-initialized', function() {
            participation.init();
        });
    }
});

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

    /* Спеціальний стиль для невидимого подання кількості білетів */
    .ticket-count-ghost {
        position: absolute;
        opacity: 0;
        pointer-events: none;
    }
`;
document.head.appendChild(styleElement);

// Глобальний обробник помилок для автоматичного скидання стану при критичних помилках
window.addEventListener('error', function(event) {
    console.error('🚨 Глобальна помилка в participation:', event.error);

    if (participation && (participation.activeTransactions.size > 0 || Object.keys(participation.pendingRequests).length > 0)) {
        console.warn('⚠️ Виявлено активні транзакції під час помилки. Скидаємо стан...');
        participation.resetState();
    }

    // ДОДАНО: Скидаємо стан обробки запиту
    if (participation) {
        participation.requestInProgress = false;
        participation.syncLock = false;
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

    // ДОДАНО: Скидаємо стан обробки запиту
    if (participation) {
        participation.requestInProgress = false;
        participation.syncLock = false;
    }
});

// ДОДАНО: Очищення "застряглих" станів при завантаженні сторінки
window.addEventListener('load', function() {
    // Затримка для того, щоб інші скрипти встигли ініціалізуватися
    setTimeout(function() {
        if (window.WinixRaffles && window.WinixRaffles.participation) {
            // Очищаємо кнопки в стані обробки
            document.querySelectorAll('.join-button.processing, .mini-raffle-button.processing').forEach(button => {
                button.classList.remove('processing');
                button.disabled = false;

                // Відновлюємо текст кнопки
                const originalText = button.getAttribute('data-original-text');
                if (originalText) {
                    button.textContent = originalText;
                } else {
                    const entryFee = button.getAttribute('data-entry-fee') || '1';
                    button.textContent = button.classList.contains('mini-raffle-button') ?
                        'Взяти участь' :
                        `Взяти участь за ${entryFee} жетон${parseInt(entryFee) > 1 ? 'и' : ''}`;
                }
            });

            // Скидаємо прапорці блокування
            window.WinixRaffles.participation.requestInProgress = false;
            window.WinixRaffles.participation.syncLock = false;

            // Перевіряємо стан активних транзакцій
            setTimeout(() => {
                window.WinixRaffles.participation.verifyAndFixParticipationState();
            }, 3000);
        }
    }, 2000);
});

console.log('✅ Модуль participation.js успішно завантажено');
})();