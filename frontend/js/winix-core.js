/**
 * WinixCore.js - Уніфікована система управління даними WINIX
 *
 * Оптимізована версія - вся бізнес-логіка виконується на сервері
 * Фронтенд лише надсилає запити до API та відображає результати
 */

(function() {
    // Запобігаємо повторній ініціалізації
    if (window.WinixCore) {
        console.log("✅ WinixCore вже ініціалізовано");
        return window.WinixCore;
    }

    // --------------- ПРИВАТНІ КОНСТАНТИ ---------------

    // Ключі для localStorage
    const STORAGE_KEYS = {
        // Баланси
        USER_TOKENS: 'winix_balance',
        USER_COINS: 'winix_coins',

        // Стейкінг
        STAKING_DATA: 'winix_staking',
        STAKING_HISTORY: 'winix_staking_history',

        // Транзакції
        TRANSACTIONS: 'winix_transactions',

        // Реферальна система
        REFERRAL_DATA: 'winix_referral',

        // Метадані
        VERSION: 'winix_version',
        LAST_SYNC: 'winix_last_sync'
    };

    // Типи транзакцій
    const TRANSACTION_TYPES = {
        RECEIVE: 'receive',
        SEND: 'send',
        STAKE: 'stake',
        UNSTAKE: 'unstake',
        REWARD: 'reward',
        FEE: 'fee'
    };

    // Типи повідомлень
    const MESSAGE_TYPES = {
        SUCCESS: 'success',
        ERROR: 'error',
        INFO: 'info',
        WARNING: 'warning'
    };

    // --------------- ПРИВАТНІ ЗМІННІ ---------------

    // Прапорці блокування операцій
    let _isProcessingRequest = false;

    // Списки обробників подій
    let _eventListeners = {
        balanceChanged: [],
        stakingChanged: [],
        transactionAdded: [],
        stakingCreated: [],
        stakingCancelled: []
    };

    // Конфігурація
    let _config = {
        debug: false,
        autoSync: true,
        syncInterval: 5000
    };

    // --------------- ДОПОМІЖНІ ФУНКЦІЇ ---------------

    /**
     * Логування з префіксом системи
     */
    function log(type, message, data) {
        if (!_config.debug && type !== 'error') return;

        const prefix = '🏦 WINIX CORE';

        switch (type) {
            case 'error':
                console.error(`${prefix} ПОМИЛКА:`, message, data);
                break;
            case 'warn':
                console.warn(`${prefix} ПОПЕРЕДЖЕННЯ:`, message, data);
                break;
            case 'info':
                console.info(`${prefix} ІНФО:`, message, data);
                break;
            default:
                console.log(`${prefix}:`, message, data);
        }
    }

    /**
     * Безпечне парсування JSON
     */
    function safeParseJSON(json, defaultValue = null) {
        try {
            return json ? JSON.parse(json) : defaultValue;
        } catch (e) {
            log('error', 'Помилка парсування JSON', {json, error: e});
            return defaultValue;
        }
    }

    /**
     * Безпечне збереження даних в localStorage
     */
    function safeSetItem(key, value) {
        try {
            // Для об'єктів і масивів використовуємо JSON.stringify
            if (typeof value === 'object' && value !== null) {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }
            return true;
        } catch (e) {
            log('error', `Помилка збереження ${key} в localStorage`, e);
            return false;
        }
    }

    /**
     * Безпечне отримання даних з localStorage
     */
    function safeGetItem(key, defaultValue = null, parse = false) {
        try {
            const value = localStorage.getItem(key);

            if (value === null) return defaultValue;

            if (parse) {
                return safeParseJSON(value, defaultValue);
            }

            return value;
        } catch (e) {
            log('error', `Помилка отримання ${key} з localStorage`, e);
            return defaultValue;
        }
    }

    /**
     * Виконання API-запиту з обробкою помилок
     */
    async function apiRequest(endpoint, options = {}) {
        try {
            const userId = localStorage.getItem('telegram_user_id') ||
                          (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

            if (userId) {
                options.headers = options.headers || {};
                options.headers['X-Telegram-User-Id'] = userId;
            }

            const response = await fetch(endpoint, options);

            if (!response.ok) {
                throw new Error(`HTTP помилка! Статус: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            log('error', `Помилка API-запиту на ${endpoint}`, error);
            throw error;
        }
    }

    /**
     * Генерація події системи
     */
    function emitEvent(eventName, data) {
        if (!_eventListeners[eventName]) return;

        _eventListeners[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                log('error', `Помилка виконання обробника події ${eventName}`, e);
            }
        });
    }

    /**
     * Синхронізація даних користувача з сервером
     */
    async function syncUserData() {
        try {
            const userId = localStorage.getItem('telegram_user_id') ||
                          (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

            if (!userId) {
                log('warn', 'Неможливо синхронізувати дані: ID користувача не знайдено');
                return false;
            }

            log('info', 'Початок синхронізації даних з сервером');

            const data = await apiRequest(`/api/user/${userId}`);

            if (data.status === 'success' && data.data) {
                // Оновлюємо дані балансу
                if (data.data.balance !== undefined) {
                    safeSetItem(STORAGE_KEYS.USER_TOKENS, data.data.balance.toString());
                }

                if (data.data.coins !== undefined) {
                    safeSetItem(STORAGE_KEYS.USER_COINS, data.data.coins.toString());
                }

                // Оновлюємо дані стейкінгу
                if (data.data.staking_data) {
                    safeSetItem(STORAGE_KEYS.STAKING_DATA, data.data.staking_data);
                }

                // Оновлюємо транзакції
                if (Array.isArray(data.data.transactions)) {
                    safeSetItem(STORAGE_KEYS.TRANSACTIONS, data.data.transactions);
                }

                log('info', 'Синхронізація даних з сервером успішна');
                safeSetItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());

                // Оновлюємо відображення
                UIManager.updateBalanceDisplay();
                UIManager.updateStakingDisplay();

                return true;
            } else {
                log('error', 'Помилка отримання даних з сервера', data);
                return false;
            }
        } catch (error) {
            log('error', 'Помилка синхронізації даних з сервером', error);
            return false;
        }
    }

    // --------------- ОСНОВНА СИСТЕМА ---------------

    /**
     * Менеджер балансу - спрощений, всі розрахунки на бекенді
     */
    const BalanceManager = {
        /**
         * Отримання балансу WINIX
         */
        getTokens: function() {
            const balance = parseFloat(safeGetItem(STORAGE_KEYS.USER_TOKENS, '0'));
            return isNaN(balance) ? 0 : balance;
        },

        /**
         * Отримання балансу жетонів
         */
        getCoins: function() {
            const coins = parseFloat(safeGetItem(STORAGE_KEYS.USER_COINS, '0'));
            return isNaN(coins) ? 0 : coins;
        },

        /**
         * Оновлення балансу з сервера
         */
        syncBalanceFromServer: async function() {
            try {
                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) return false;

                const data = await apiRequest(`/api/user/${userId}/balance`);

                if (data.status === 'success' && data.data) {
                    // Оновлюємо локальне сховище
                    if (data.data.balance !== undefined) {
                        safeSetItem(STORAGE_KEYS.USER_TOKENS, data.data.balance.toString());
                    }

                    if (data.data.coins !== undefined) {
                        safeSetItem(STORAGE_KEYS.USER_COINS, data.data.coins.toString());
                    }

                    // Оновлюємо відображення
                    UIManager.updateBalanceDisplay();
                    return true;
                }
                return false;
            } catch (error) {
                log('error', 'Помилка синхронізації балансу', error);
                return false;
            }
        }
    };

    /**
     * Менеджер стейкінгу - оптимізований, використовує лише серверні API
     */
    const StakingManager = {
        /**
         * Перевірка наявності активного стейкінгу
         */
        hasActiveStaking: function() {
            const stakingData = safeGetItem(STORAGE_KEYS.STAKING_DATA, null, true);
            return stakingData && stakingData.hasActiveStaking === true;
        },

        /**
         * Отримання даних активного стейкінгу
         */
        getStakingData: function() {
            // Запускаємо фонову синхронізацію
            this.syncStakingFromServer();

            // Повертаємо кешовані дані
            const data = safeGetItem(STORAGE_KEYS.STAKING_DATA, null, true);

            // Якщо дані відсутні, повертаємо порожній об'єкт
            if (!data || typeof data !== 'object') {
                return {
                    hasActiveStaking: false,
                    stakingAmount: 0,
                    rewardPercent: 0,
                    expectedReward: 0,
                    remainingDays: 0
                };
            }

            return data;
        },

        /**
         * Синхронізація даних стейкінгу з сервера
         */
        syncStakingFromServer: async function() {
            try {
                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) return false;

                log('info', 'Синхронізація даних стейкінгу з сервера');

                const data = await apiRequest(`/api/user/${userId}/staking`);

                if (data.status === 'success' && data.data) {
                    // Зберігаємо дані стейкінгу
                    safeSetItem(STORAGE_KEYS.STAKING_DATA, data.data);
                    log('info', 'Дані стейкінгу успішно синхронізовано');

                    // Оновлюємо відображення
                    UIManager.updateStakingDisplay();
                    return true;
                }
                return false;
            } catch (error) {
                log('error', 'Помилка синхронізації даних стейкінгу', error);
                return false;
            }
        },

        /**
         * Синхронізація історії стейкінгу
         */
        syncStakingHistoryFromServer: async function() {
            try {
                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) return false;

                const data = await apiRequest(`/api/user/${userId}/staking/history`);

                if (data.status === 'success' && Array.isArray(data.data)) {
                    // Зберігаємо історію стейкінгу
                    safeSetItem(STORAGE_KEYS.STAKING_HISTORY, data.data);
                    return true;
                }
                return false;
            } catch (error) {
                log('error', 'Помилка синхронізації історії стейкінгу', error);
                return false;
            }
        },

        /**
         * Створення нового стейкінгу (через API)
         */
        createStaking: async function(amount, period) {
            if (_isProcessingRequest) {
                return { success: false, message: 'Запит вже обробляється' };
            }

            _isProcessingRequest = true;

            try {
                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) {
                    return { success: false, message: 'ID користувача не знайдено' };
                }

                // Надсилаємо запит на сервер
                const result = await apiRequest(`/api/user/${userId}/staking`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stakingAmount: amount, period: period })
                });

                // Якщо успішно - оновлюємо локальні дані
                if (result.status === 'success') {
                    // Зберігаємо дані стейкінгу
                    if (result.data && result.data.staking) {
                        safeSetItem(STORAGE_KEYS.STAKING_DATA, result.data.staking);
                    }

                    // Оновлюємо баланс
                    await BalanceManager.syncBalanceFromServer();

                    // Оновлюємо відображення
                    UIManager.updateStakingDisplay();

                    // Генеруємо подію
                    emitEvent('stakingCreated', result.data.staking);

                    return {
                        success: true,
                        message: 'Стейкінг успішно створено',
                        data: result.data
                    };
                } else {
                    return {
                        success: false,
                        message: result.message || 'Помилка створення стейкінгу'
                    };
                }
            } catch (error) {
                log('error', 'Помилка створення стейкінгу', error);
                return {
                    success: false,
                    message: 'Помилка з\'єднання з сервером'
                };
            } finally {
                _isProcessingRequest = false;
            }
        },

        /**
         * Додавання коштів до стейкінгу (через API)
         */
        addToStaking: async function(amount) {
            if (_isProcessingRequest) {
                return { success: false, message: 'Запит вже обробляється' };
            }

            _isProcessingRequest = true;

            try {
                const stakingData = this.getStakingData();

                if (!stakingData || !stakingData.hasActiveStaking) {
                    return { success: false, message: 'Немає активного стейкінгу' };
                }

                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) {
                    return { success: false, message: 'ID користувача не знайдено' };
                }

                // Надсилаємо запит на сервер
                const result = await apiRequest(`/api/user/${userId}/staking/${stakingData.stakingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ additionalAmount: amount })
                });

                // Якщо успішно - оновлюємо локальні дані
                if (result.status === 'success') {
                    // Зберігаємо оновлені дані стейкінгу
                    if (result.data && result.data.staking) {
                        safeSetItem(STORAGE_KEYS.STAKING_DATA, result.data.staking);
                    }

                    // Оновлюємо баланс
                    await BalanceManager.syncBalanceFromServer();

                    // Оновлюємо відображення
                    UIManager.updateStakingDisplay();

                    // Генеруємо подію
                    emitEvent('stakingChanged', result.data.staking);

                    return {
                        success: true,
                        message: `Додано ${amount} WINIX до стейкінгу`,
                        data: result.data
                    };
                } else {
                    return {
                        success: false,
                        message: result.message || 'Помилка додавання до стейкінгу'
                    };
                }
            } catch (error) {
                log('error', 'Помилка додавання до стейкінгу', error);
                return {
                    success: false,
                    message: 'Помилка з\'єднання з сервером'
                };
            } finally {
                _isProcessingRequest = false;
            }
        },

        /**
         * Скасування стейкінгу (через API)
         */
        cancelStaking: async function() {
            if (_isProcessingRequest) {
                return { success: false, message: 'Запит вже обробляється' };
            }

            _isProcessingRequest = true;

            try {
                const stakingData = this.getStakingData();

                if (!stakingData || !stakingData.hasActiveStaking) {
                    return { success: false, message: 'Немає активного стейкінгу' };
                }

                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) {
                    return { success: false, message: 'ID користувача не знайдено' };
                }

                // Надсилаємо запит на сервер
                const result = await apiRequest(`/api/user/${userId}/staking/${stakingData.stakingId}/cancel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(stakingData)
                });

                // Якщо успішно - оновлюємо локальні дані
                if (result.status === 'success') {
                    // Видаляємо дані стейкінгу
                    localStorage.removeItem(STORAGE_KEYS.STAKING_DATA);

                    // Якщо сервер повернув порожні дані стейкінгу, зберігаємо їх
                    if (result.data && result.data.staking) {
                        safeSetItem(STORAGE_KEYS.STAKING_DATA, result.data.staking);
                    }

                    // Оновлюємо баланс
                    await BalanceManager.syncBalanceFromServer();

                    // Оновлюємо відображення
                    UIManager.updateStakingDisplay();

                    // Генеруємо подію
                    emitEvent('stakingCancelled', {
                        stakingAmount: stakingData.stakingAmount,
                        returnedAmount: result.data.returnedAmount || 0
                    });

                    return {
                        success: true,
                        message: result.message || 'Стейкінг успішно скасовано',
                        data: result.data
                    };
                } else {
                    return {
                        success: false,
                        message: result.message || 'Помилка скасування стейкінгу'
                    };
                }
            } catch (error) {
                log('error', 'Помилка скасування стейкінгу', error);
                return {
                    success: false,
                    message: 'Помилка з\'єднання з сервером'
                };
            } finally {
                _isProcessingRequest = false;
            }
        },

        /**
         * Отримання історії стейкінгу
         */
        getStakingHistory: function(limit = 0) {
            const history = safeGetItem(STORAGE_KEYS.STAKING_HISTORY, [], true);

            // Запускаємо фонову синхронізацію
            this.syncStakingHistoryFromServer();

            if (limit > 0 && history.length > limit) {
                return history.slice(0, limit);
            }

            return history;
        }
    };

    /**
     * Менеджер транзакцій - спрощений
     */
    const TransactionManager = {
        /**
         * Отримання всіх транзакцій
         */
        getTransactions: function() {
            return safeGetItem(STORAGE_KEYS.TRANSACTIONS, [], true);
        },

        /**
         * Отримання останніх транзакцій
         */
        getRecentTransactions: function(limit = 3) {
            const transactions = this.getTransactions();
            return transactions.slice(0, limit);
        },

        /**
         * Синхронізація транзакцій з сервера
         */
        syncTransactionsFromServer: async function() {
            try {
                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) return false;

                const data = await apiRequest(`/api/user/${userId}/transactions`);

                if (data.status === 'success' && Array.isArray(data.data)) {
                    // Зберігаємо транзакції
                    safeSetItem(STORAGE_KEYS.TRANSACTIONS, data.data);
                    return true;
                }
                return false;
            } catch (error) {
                log('error', 'Помилка синхронізації транзакцій', error);
                return false;
            }
        },

        /**
         * Отримання тексту для типу транзакції
         */
        getTransactionText: function(type) {
            switch (type) {
                case TRANSACTION_TYPES.RECEIVE:
                    return 'Отримано';
                case TRANSACTION_TYPES.SEND:
                    return 'Надіслано';
                case TRANSACTION_TYPES.STAKE:
                    return 'Застейкано';
                case TRANSACTION_TYPES.UNSTAKE:
                    return 'Розстейкано';
                case TRANSACTION_TYPES.REWARD:
                    return 'Винагорода';
                case TRANSACTION_TYPES.FEE:
                    return 'Комісія';
                default:
                    return 'Транзакція';
            }
        },

        /**
         * Отримання класу CSS для типу транзакції
         */
        getTransactionClass: function(type) {
            switch (type) {
                case TRANSACTION_TYPES.RECEIVE:
                case TRANSACTION_TYPES.UNSTAKE:
                case TRANSACTION_TYPES.REWARD:
                    return 'transaction-positive';
                case TRANSACTION_TYPES.SEND:
                case TRANSACTION_TYPES.FEE:
                    return 'transaction-negative';
                case TRANSACTION_TYPES.STAKE:
                    return 'transaction-neutral';
                default:
                    return '';
            }
        },

        /**
         * Отримання префікса для суми транзакції
         */
        getTransactionPrefix: function(type) {
            switch (type) {
                case TRANSACTION_TYPES.RECEIVE:
                case TRANSACTION_TYPES.UNSTAKE:
                case TRANSACTION_TYPES.REWARD:
                    return '+';
                case TRANSACTION_TYPES.SEND:
                case TRANSACTION_TYPES.STAKE:
                case TRANSACTION_TYPES.FEE:
                    return '-';
                default:
                    return '';
            }
        }
    };

    /**
     * Створюємо обгортку для роботи з UI
     */
    const UIManager = {
        /**
         * Оновлення відображення балансу на сторінці
         */
        updateBalanceDisplay: function() {
            try {
                // Отримуємо поточний баланс
                const tokenBalance = BalanceManager.getTokens();
                const coinsBalance = BalanceManager.getCoins();

                log('info', 'Оновлення відображення балансу', {
                    tokens: tokenBalance,
                    coins: coinsBalance
                });

                // Оновлюємо всі елементи, які показують баланс токенів
                const tokenSelectors = [
                    '#user-tokens',
                    '#main-balance',
                    '.balance-amount',
                    '#current-balance',
                    '.balance-value'
                ];

                tokenSelectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        if (element) {
                            // Якщо елемент має спеціальну розмітку для іконки, зберігаємо її
                            if (element.id === 'main-balance' && element.innerHTML && element.innerHTML.includes('main-balance-icon')) {
                                element.innerHTML = `${tokenBalance.toFixed(2)} <span class="main-balance-icon"><img src="assets/token.png" width="100" height="100" alt="WINIX"></span>`;
                            } else {
                                element.textContent = tokenBalance.toFixed(2);
                            }
                        }
                    });
                });

                // Оновлюємо відображення жетонів
                const coinsSelectors = [
                    '#user-coins',
                    '.coins-amount',
                    '.coins-value'
                ];

                coinsSelectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        if (element) {
                            element.textContent = coinsBalance.toFixed(0);
                        }
                    });
                });

                return true;
            } catch (e) {
                log('error', 'Помилка оновлення відображення балансу', e);
                return false;
            }
        },

        /**
         * Оновлення відображення стейкінгу на сторінці
         */
        updateStakingDisplay: function() {
            try {
                // Отримуємо дані стейкінгу
                const stakingData = StakingManager.getStakingData();
                const hasStaking = stakingData && stakingData.hasActiveStaking;

                log('info', 'Оновлення відображення стейкінгу', {
                    hasStaking,
                    stakingData
                });

                // Якщо ми на сторінці стейкінгу
                if (window.location.href.includes('staking.html')) {
                    // Оновлюємо статус стейкінгу
                    const statusElement = document.getElementById('staking-status');
                    if (statusElement) {
                        statusElement.textContent = hasStaking
                            ? `У стейкінгу: ${stakingData.stakingAmount.toFixed(2)} $WINIX`
                            : "Наразі немає активних стейкінгів";
                    }

                    // Оновлюємо видимість кнопок
                    const detailsButton = document.getElementById('details-button');
                    const cancelButton = document.getElementById('cancel-staking-button');

                    if (detailsButton) {
                        detailsButton.style.opacity = hasStaking ? '1' : '0.5';
                        detailsButton.style.pointerEvents = hasStaking ? 'auto' : 'none';
                    }

                    if (cancelButton) {
                        cancelButton.style.opacity = hasStaking ? '1' : '0.5';
                        cancelButton.style.pointerEvents = hasStaking ? 'auto' : 'none';
                    }
                }
                // Якщо ми на сторінці деталей стейкінгу
                else if (window.location.href.includes('staking-details.html')) {
                    // Оновлюємо елементи інтерфейсу
                    const amountElement = document.getElementById('staking-amount');
                    const periodElement = document.getElementById('staking-period');
                    const rewardPercentElement = document.getElementById('staking-reward-percent');
                    const expectedRewardElement = document.getElementById('staking-expected-reward');
                    const remainingDaysElement = document.getElementById('staking-remaining-days');

                    if (amountElement) amountElement.textContent = `${stakingData.stakingAmount.toFixed(2)} $WINIX`;
                    if (periodElement) periodElement.textContent = `${stakingData.period} днів`;
                    if (rewardPercentElement) rewardPercentElement.textContent = `${stakingData.rewardPercent}%`;
                    if (expectedRewardElement) expectedRewardElement.textContent = `${stakingData.expectedReward.toFixed(2)} $WINIX`;
                    if (remainingDaysElement) remainingDaysElement.textContent = stakingData.remainingDays.toString();
                }
                // Якщо ми на головній сторінці гаманця
                else if (window.location.href.includes('wallet.html')) {
                    // Оновлюємо інформацію про стейкінг
                    const stakingBalanceElement = document.getElementById('staking-balance');
                    const stakingRewardsElement = document.getElementById('staking-rewards');

                    if (stakingBalanceElement) {
                        stakingBalanceElement.textContent = `У стейкінгу: ${hasStaking ? stakingData.stakingAmount.toFixed(2) : '0'} $WINIX`;
                    }

                    if (stakingRewardsElement) {
                        stakingRewardsElement.textContent = `Нагороди: ${hasStaking ? stakingData.expectedReward.toFixed(2) : '0'} $WINIX`;
                    }
                }

                return true;
            } catch (e) {
                log('error', 'Помилка оновлення відображення стейкінгу', e);
                return false;
            }
        },

        /**
         * Оновлення списку транзакцій на сторінці
         */
        updateTransactionsList: function(elementId = 'transaction-list', limit = 3) {
            try {
                const listElement = document.getElementById(elementId);
                if (!listElement) return false;

                // Отримуємо останні транзакції
                const recentTransactions = TransactionManager.getRecentTransactions(limit);

                // Очищаємо список
                listElement.innerHTML = '';

                if (recentTransactions.length === 0) {
                    listElement.innerHTML = '<div class="empty-message">У вас ще немає транзакцій</div>';
                    return true;
                }

                // Додаємо кожну транзакцію
                recentTransactions.forEach(transaction => {
                    const transactionElement = document.createElement('div');
                    transactionElement.className = 'transaction-item';
                    transactionElement.setAttribute('data-tx-id', transaction.id);

                    const txText = TransactionManager.getTransactionText(transaction.type);
                    const amountClass = TransactionManager.getTransactionClass(transaction.type);
                    const amountPrefix = TransactionManager.getTransactionPrefix(transaction.type);

                    transactionElement.innerHTML = `
                        <div class="transaction-details">${transaction.description || txText}</div>
                        <div class="transaction-amount ${amountClass}">${amountPrefix}${transaction.amount.toFixed(2)} $WINIX</div>
                    `;

                    listElement.appendChild(transactionElement);
                });

                return true;
            } catch (e) {
                log('error', 'Помилка оновлення списку транзакцій', e);
                return false;
            }
        },

        /**
         * Відображення сповіщення
         */
        showNotification: function(message, type = MESSAGE_TYPES.SUCCESS, callback = null) {
            try {
                // Перевіряємо, чи є вже сповіщення
                let toastElement = document.getElementById('toast-message');

                if (!toastElement) {
                    // Створюємо елемент сповіщення
                    toastElement = document.createElement('div');
                    toastElement.id = 'toast-message';
                    toastElement.className = 'toast-message';
                    document.body.appendChild(toastElement);
                }

                // Встановлюємо текст і стиль сповіщення
                toastElement.textContent = message;

                // Встановлюємо колір фону залежно від типу
                switch (type) {
                    case MESSAGE_TYPES.SUCCESS:
                        toastElement.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
                        break;
                    case MESSAGE_TYPES.ERROR:
                        toastElement.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
                        break;
                    case MESSAGE_TYPES.WARNING:
                        toastElement.style.backgroundColor = 'rgba(255, 152, 0, 0.9)';
                        break;
                    case MESSAGE_TYPES.INFO:
                        toastElement.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
                        break;
                }

                // Показуємо сповіщення
                toastElement.classList.add('show');

                // Автоматично приховуємо через 3 секунди
                setTimeout(() => {
                    toastElement.classList.remove('show');

                    // Викликаємо callback після анімації
                    if (callback) {
                        setTimeout(callback, 500);
                    }
                }, 3000);

                return true;
            } catch (e) {
                log('error', 'Помилка відображення сповіщення', e);
                return false;
            }
        }
    };

    // --------------- ПУБЛІЧНИЙ API ---------------

    /**
     * Публічний API для використання з інших частин програми
     */
    const WinixCore = {
        /**
         * Ініціалізація системи
         */
        init: async function(config = {}) {
            try {
                log('info', 'Ініціалізація WinixCore');

                // Оновлюємо конфігурацію
                Object.assign(_config, config);

                // Спроба початкової синхронізації з сервером
                try {
                    // Перевіряємо наявність ID користувача
                    const userId = localStorage.getItem('telegram_user_id') ||
                                  (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                    if (userId) {
                        // Синхронізуємо дані з сервера
                        await syncUserData();
                        log('info', 'Початкова синхронізація з сервером успішна');
                    } else {
                        log('warn', 'Неможливо синхронізувати дані: ID користувача не знайдено');
                    }
                } catch (syncError) {
                    log('warn', 'Помилка початкової синхронізації з сервером', syncError);
                    log('info', 'Продовження з локальними даними');
                }

                // Налаштовуємо автоматичну синхронізацію
                if (_config.autoSync) {
                    this.startAutoSync();
                }

                // Запускаємо патчі для сумісності з іншими системами
                this._applyCompatibilityPatches();

                log('info', 'WinixCore успішно ініціалізовано');
                return true;
            } catch (e) {
                log('error', 'Помилка ініціалізації WinixCore', e);
                return false;
            }
        },

        /**
         * Запуск автоматичної синхронізації
         */
        startAutoSync: function() {
            // Оновлюємо UI кожні N мілісекунд
            setInterval(() => {
                try {
                    UIManager.updateBalanceDisplay();
                    UIManager.updateStakingDisplay();
                } catch (e) {
                    log('error', 'Помилка автоматичного оновлення UI', e);
                }
            }, _config.syncInterval);

            // Синхронізуємо дані з сервером кожні 30 секунд
            const serverSyncInterval = 30000; // 30 секунд
            setInterval(() => {
                try {
                    // Перевіряємо наявність ID користувача
                    const userId = localStorage.getItem('telegram_user_id') ||
                                  (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                    if (userId) {
                        // Синхронізуємо дані з сервера
                        syncUserData().catch(error => {
                            log('error', 'Помилка періодичної синхронізації з сервером', error);
                        });
                    }
                } catch (e) {
                    log('error', 'Помилка під час спроби періодичної синхронізації', e);
                }
            }, serverSyncInterval);

            log('info', `Запущено автоматичну синхронізацію UI з інтервалом ${_config.syncInterval}мс`);
            log('info', `Запущено періодичну синхронізацію з сервером з інтервалом 30с`);

            // Додаємо обробник для синхронізації при поверненні на вкладку
            window.addEventListener('focus', () => {
                try {
                    const userId = localStorage.getItem('telegram_user_id') ||
                                  (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                    if (userId) {
                        syncUserData().catch(error => {
                            log('error', 'Помилка синхронізації при поверненні на вкладку', error);
                        });
                    }
                } catch (e) {
                    log('error', 'Помилка під час спроби синхронізації при поверненні на вкладку', e);
                }
            });
        },

        /**
         * Встановлення обробника події
         */
        on: function(eventName, callback) {
            if (!_eventListeners[eventName]) {
                _eventListeners[eventName] = [];
            }

            _eventListeners[eventName].push(callback);
            return this;
        },

        /**
         * Видалення обробника події
         */
        off: function(eventName, callback) {
            if (!_eventListeners[eventName]) return this;

            _eventListeners[eventName] = _eventListeners[eventName].filter(
                cb => cb !== callback
            );
            return this;
        },

        /**
         * Застосування патчів для сумісності з іншими системами
         */
        _applyCompatibilityPatches: function() {
            log('info', 'Застосування патчів для сумісності з іншими системами');

            // Патч для старої RewardSystem
            if (!window.rewardSystem) {
                window.rewardSystem = {
                    getUserTokens: BalanceManager.getTokens,
                    getUserCoins: BalanceManager.getCoins,
                    updateBalanceDisplay: UIManager.updateBalanceDisplay
                };
            }

            // Патч для StakingSystem
            if (!window.stakingSystem) {
                window.stakingSystem = {
                    hasActiveStaking: StakingManager.hasActiveStaking,
                    getStakingDisplayData: StakingManager.getStakingData,
                    getStakingHistory: StakingManager.getStakingHistory,
                    createStaking: function(amount, period) {
                        return StakingManager.createStaking(amount, period)
                            .then(result => {
                                if (result.success) {
                                    UIManager.showNotification('Стейкінг успішно створено');
                                } else {
                                    UIManager.showNotification(result.message, MESSAGE_TYPES.ERROR);
                                }
                                return result;
                            });
                    },
                    cancelStaking: function() {
                        return StakingManager.cancelStaking()
                            .then(result => {
                                if (result.success) {
                                    UIManager.showNotification(result.message);
                                } else {
                                    UIManager.showNotification(result.message, MESSAGE_TYPES.ERROR);
                                }
                                return result;
                            });
                    },
                    updateStakingDisplay: UIManager.updateStakingDisplay,
                    walletSystem: {
                        getBalance: BalanceManager.getTokens
                    }
                };
            }

            // Патч для TransactionSystem
            if (!window.transactionSystem) {
                window.transactionSystem = {
                    getTransactions: TransactionManager.getTransactions,
                    getRecentTransactions: TransactionManager.getRecentTransactions,
                    getTransactionText: TransactionManager.getTransactionText,
                    getTransactionClass: TransactionManager.getTransactionClass,
                    getTransactionAmountPrefix: TransactionManager.getTransactionPrefix,
                    updateTransactionsList: UIManager.updateTransactionsList,
                    hasRealTransactions: true,
                    shouldShowTestTransactions: function() { return true; },
                    transactions: TransactionManager.getTransactions()
                };
            }

            // Патч для глобальних функцій
            window.getUserTokens = BalanceManager.getTokens;
            window.getUserCoins = BalanceManager.getCoins;
            window.getBalance = BalanceManager.getTokens;

            // Додаємо глобальні функції навігації з безпечним збереженням балансу
            window.navigateTo = function(page) {
                // Зберігаємо баланс перед навігацією
                sessionStorage.setItem('lastBalance', BalanceManager.getTokens().toString());
                sessionStorage.setItem('lastCoins', BalanceManager.getCoins().toString());
                sessionStorage.setItem('navigationTime', Date.now().toString());

                window.location.href = page;
            };

            // Додаємо функції для UI
            window.showToast = UIManager.showNotification;
            window.updateBalanceDisplay = UIManager.updateBalanceDisplay;
            window.updateStakingDisplay = UIManager.updateStakingDisplay;
            window.updateTransactionsList = UIManager.updateTransactionsList;

            log('info', 'Патчі для сумісності успішно застосовано');
        },

        // Експортуємо публічні інтерфейси для зручного доступу
        Balance: BalanceManager,
        Staking: StakingManager,
        Transactions: TransactionManager,
        UI: UIManager,

        // Експортуємо константи
        TRANSACTION_TYPES,
        MESSAGE_TYPES,
        STORAGE_KEYS
    };

    // Збереження екземпляру в глобальній області видимості
    window.WinixCore = WinixCore;

    // Автоматична ініціалізація при завантаженні
    document.addEventListener('DOMContentLoaded', function() {
        // Перевіряємо, чи вже не ініціалізовано
        if (!window.WinixCoreInitialized) {
            WinixCore.init();
            window.WinixCoreInitialized = true;

            log('info', 'WinixCore автоматично ініціалізовано при завантаженні сторінки');

            // Оновлюємо відображення після завантаження
            setTimeout(function() {
                UIManager.updateBalanceDisplay();
                UIManager.updateStakingDisplay();
                UIManager.updateTransactionsList();

                // Відправляємо подію про ініціалізацію
                document.dispatchEvent(new CustomEvent('winix-core-initialized'));
            }, 300);
        }
    });

    // Якщо DOM вже готовий, ініціалізуємо сторінку зараз
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        if (!window.WinixCoreInitialized) {
            WinixCore.init();
            window.WinixCoreInitialized = true;

            log('info', 'WinixCore автоматично ініціалізовано (DOM вже готовий)');

            // Оновлюємо відображення після завантаження
            setTimeout(function() {
                UIManager.updateBalanceDisplay();
                UIManager.updateStakingDisplay();
                UIManager.updateTransactionsList();

                // Відправляємо подію про ініціалізацію
                document.dispatchEvent(new CustomEvent('winix-core-initialized'));
            }, 300);
        }
    }

    // Повертаємо публічний API
    return WinixCore;
})();