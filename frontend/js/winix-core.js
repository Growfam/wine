/**
 * WinixCore.js - Уніфікована система управління даними WINIX
 *
 * Оптимізована версія - вся бізнес-логіка виконується на сервері
 * Фронтенд лише надсилає запити до API та відображає результати
 * Використовує єдиний API модуль для всіх запитів
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

    // Налаштування стейкінгу
    const STAKING_CONFIG = {
        minAmount: 50,
        maxBalancePercentage: 0.9,
        allowedPeriods: [7, 14, 28],
        rewardRates: {
            7: 4,  // 4% за 7 днів
            14: 9, // 9% за 14 днів
            28: 15 // 15% за 28 днів
        }
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
            log('info', 'Початок синхронізації даних з сервером');

            // Використовуємо API модуль для отримання даних користувача
            const data = await window.WinixAPI.getUserData();

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
                // Виклик функції оновлення стейкінгу з нової системи
                if (window.WinixStakingSystem && typeof window.WinixStakingSystem.updateStakingDisplay === 'function') {
                    window.WinixStakingSystem.updateStakingDisplay();
                }

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
     * Менеджер балансу - використовує API модуль
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
                // Використовуємо API модуль для отримання балансу
                const data = await window.WinixAPI.getBalance();

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
        },

        /**
         * Додавання токенів до балансу користувача через API
         * @param {number} amount - Кількість токенів
         * @param {string} description - Опис транзакції
         */
        addTokens: async function(amount, description = 'Додавання токенів') {
            try {
                // Використовуємо API модуль для додавання токенів
                const data = await window.WinixAPI.addTokens(amount, description);

                if (data && data.status === 'success') {
                    // Оновлюємо локальний баланс
                    if (data.data && data.data.new_balance !== undefined) {
                        safeSetItem(STORAGE_KEYS.USER_TOKENS, data.data.new_balance.toString());
                    }

                    // Оновлюємо відображення
                    UIManager.updateBalanceDisplay();

                    // Відправляємо подію про зміну балансу
                    emitEvent('balanceChanged', {
                        previous: data.data.previous_balance,
                        current: data.data.new_balance,
                        change: amount
                    });

                    return true;
                }

                return false;
            } catch (error) {
                log('error', 'Помилка додавання токенів', error);
                return false;
            }
        },

        /**
         * Віднімання токенів з балансу користувача через API
         * @param {number} amount - Кількість токенів
         * @param {string} description - Опис транзакції
         */
        subtractTokens: async function(amount, description = 'Віднімання токенів') {
            try {
                // Використовуємо API модуль для віднімання токенів
                const data = await window.WinixAPI.subtractTokens(amount, description);

                if (data && data.status === 'success') {
                    // Оновлюємо локальний баланс
                    if (data.data && data.data.new_balance !== undefined) {
                        safeSetItem(STORAGE_KEYS.USER_TOKENS, data.data.new_balance.toString());
                    }

                    // Оновлюємо відображення
                    UIManager.updateBalanceDisplay();

                    // Відправляємо подію про зміну балансу
                    emitEvent('balanceChanged', {
                        previous: data.data.previous_balance,
                        current: data.data.new_balance,
                        change: -amount
                    });

                    return true;
                }

                return false;
            } catch (error) {
                log('error', 'Помилка віднімання токенів', error);
                return false;
            }
        },

        /**
         * Додавання жетонів до балансу користувача через API
         * @param {number} amount - Кількість жетонів
         */
        addCoins: async function(amount) {
            try {
                // Використовуємо API модуль для додавання жетонів
                const data = await window.WinixAPI.addCoins(amount);

                if (data && data.status === 'success') {
                    // Оновлюємо локальний баланс жетонів
                    if (data.data && data.data.new_coins !== undefined) {
                        safeSetItem(STORAGE_KEYS.USER_COINS, data.data.new_coins.toString());
                    }

                    // Оновлюємо відображення
                    UIManager.updateBalanceDisplay();

                    return true;
                }

                return false;
            } catch (error) {
                log('error', 'Помилка додавання жетонів', error);
                return false;
            }
        },

        /**
         * Віднімання жетонів з балансу користувача через API
         * @param {number} amount - Кількість жетонів
         */
        subtractCoins: async function(amount) {
            try {
                // Використовуємо API модуль для віднімання жетонів
                const data = await window.WinixAPI.subtractCoins(amount);

                if (data && data.status === 'success') {
                    // Оновлюємо локальний баланс жетонів
                    if (data.data && data.data.new_coins !== undefined) {
                        safeSetItem(STORAGE_KEYS.USER_COINS, data.data.new_coins.toString());
                    }

                    // Оновлюємо відображення
                    UIManager.updateBalanceDisplay();

                    return true;
                }

                return false;
            } catch (error) {
                log('error', 'Помилка віднімання жетонів', error);
                return false;
            }
        },

        /**
         * Конвертація жетонів у токени через API
         * @param {number} coinsAmount - Кількість жетонів для конвертації
         */
        convertCoinsToTokens: async function(coinsAmount) {
            try {
                // Використовуємо API модуль для конвертації жетонів у токени
                const data = await window.WinixAPI.convertCoinsToTokens(coinsAmount);

                if (data && data.status === 'success') {
                    // Оновлюємо локальний баланс
                    if (data.data) {
                        if (data.data.new_tokens_balance !== undefined) {
                            safeSetItem(STORAGE_KEYS.USER_TOKENS, data.data.new_tokens_balance.toString());
                        }

                        if (data.data.new_coins_balance !== undefined) {
                            safeSetItem(STORAGE_KEYS.USER_COINS, data.data.new_coins_balance.toString());
                        }
                    }

                    // Оновлюємо відображення
                    UIManager.updateBalanceDisplay();

                    return true;
                }

                return false;
            } catch (error) {
                log('error', 'Помилка конвертації жетонів', error);
                return false;
            }
        },

        /**
         * Перевірка достатності коштів через API
         * @param {number} amount - Сума для перевірки
         * @param {string} type - Тип балансу ('tokens' або 'coins')
         */
        checkSufficientFunds: async function(amount, type = 'tokens') {
            try {
                // Спочатку спробуємо перевірити локально для швидкості
                if (type === 'tokens') {
                    const balance = this.getTokens();
                    if (balance >= amount) {
                        return {
                            success: true,
                            data: {
                                has_sufficient_funds: true,
                                current_balance: balance,
                                required_amount: amount,
                                source: 'local'
                            }
                        };
                    }
                } else if (type === 'coins') {
                    const coins = this.getCoins();
                    if (coins >= amount) {
                        return {
                            success: true,
                            data: {
                                has_sufficient_funds: true,
                                current_balance: coins,
                                required_amount: amount,
                                source: 'local'
                            }
                        };
                    }
                }

                // Перевіряємо через API
                const checkData = await window.WinixAPI.apiRequest('/api/check-funds', 'POST', {
                    amount: amount,
                    type: type
                });

                return {
                    success: checkData.status === 'success',
                    data: checkData.data
                };
            } catch (error) {
                log('error', 'Помилка перевірки достатності коштів', error);
                return { success: false, message: error.message };
            }
        }
    };

    /**
     * Менеджер транзакцій - спрощений, використовує API модуль
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
                // Використовуємо API модуль для отримання транзакцій
                const data = await window.WinixAPI.getTransactions();

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
     * Менеджер реферальної системи
     */
    const ReferralManager = {
        /**
         * Отримання реферального посилання
         */
        getReferralLink: async function() {
            try {
                // Використовуємо API модуль для отримання реферального посилання
                const data = await window.WinixAPI.getReferralLink();

                if (data.status === 'success' && data.data && data.data.referral_link) {
                    return data.data.referral_link;
                }

                return null;
            } catch (error) {
                log('error', 'Помилка отримання реферального посилання', error);
                return null;
            }
        },

        /**
         * Отримання інформації про рефералів
         */
        getReferrals: async function() {
            try {
                // Використовуємо API модуль для отримання інформації про рефералів
                const data = await window.WinixAPI.getReferrals();

                if (data.status === 'success' && data.data) {
                    return data.data;
                }

                return { direct: [], indirect: [], total_earned: 0 };
            } catch (error) {
                log('error', 'Помилка отримання інформації про рефералів', error);
                return { direct: [], indirect: [], total_earned: 0 };
            }
        },

        /**
         * Отримання винагороди за рефералів
         */
        claimReferralReward: async function() {
            try {
                // Використовуємо API модуль для отримання винагороди за рефералів
                const data = await window.WinixAPI.claimReferralReward();

                if (data.status === 'success') {
                    // Оновлюємо баланс, якщо він є у відповіді
                    if (data.data && data.data.new_balance !== undefined) {
                        safeSetItem(STORAGE_KEYS.USER_TOKENS, data.data.new_balance.toString());
                        UIManager.updateBalanceDisplay();
                    }

                    return {
                        success: true,
                        amount: data.data ? data.data.claimed_amount : 0,
                        message: data.message || 'Винагороду успішно отримано'
                    };
                }

                return {
                    success: false,
                    message: data.message || 'Не вдалося отримати винагороду'
                };
            } catch (error) {
                log('error', 'Помилка отримання винагороди за рефералів', error);
                return {
                    success: false,
                    message: 'Помилка при отриманні винагороди'
                };
            }
        }
    };

    /**
     * Менеджер стейкінгу
     */
    const StakingManager = {
        /**
         * Перевірка наявності активного стейкінгу
         */
        hasActiveStaking: function() {
            if (window.WinixStakingSystem && typeof window.WinixStakingSystem.hasActiveStaking === 'function') {
                return window.WinixStakingSystem.hasActiveStaking();
            }

            const stakingData = safeGetItem(STORAGE_KEYS.STAKING_DATA, null, true);
            return stakingData && stakingData.hasActiveStaking === true;
        },

        /**
         * Розрахунок очікуваної винагороди за стейкінг
         */
        calculateExpectedReward: function(amount, period) {
            if (window.WinixStakingSystem && typeof window.WinixStakingSystem.calculateExpectedReward === 'function') {
                return window.WinixStakingSystem.calculateExpectedReward(amount, period);
            }

            try {
                // Базова перевірка даних
                amount = parseFloat(amount);
                period = parseInt(period);

                if (isNaN(amount) || isNaN(period) || amount <= 0 || period <= 0) {
                    return 0;
                }

                // Отримуємо відсоток відповідно до періоду
                const rewardPercent = STAKING_CONFIG.rewardRates[period] || 9; // За замовчуванням 9%

                // Розраховуємо винагороду
                const reward = (amount * rewardPercent) / 100;
                return parseFloat(reward.toFixed(2));
            } catch (e) {
                log('error', 'Помилка розрахунку винагороди:', e);
                return 0;
            }
        }
    };

    /**
     * Менеджер UI
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
         * Оновлення відображення стейкінгу на сторінці
         */
        updateStakingDisplay: function() {
            if (window.WinixStakingSystem && typeof window.WinixStakingSystem.updateStakingDisplay === 'function') {
                return window.WinixStakingSystem.updateStakingDisplay();
            }

            log('warn', 'Функція оновлення стейкінгу недоступна. Потрібно завантажити WinixStakingSystem');
            return false;
        },

        /**
         * Відображення сповіщення
         */
        showNotification: function(message, type = 'success', callback = null) {
            try {
                if (window.showNotification) {
                    return window.showNotification(message, type, callback);
                }

                if (window.showToast) {
                    window.showToast(message);
                    if (callback) setTimeout(callback, 3000);
                    return true;
                }

                // Запасний варіант - звичайний alert
                alert(message);
                if (callback) setTimeout(callback, 500);
                return true;
            } catch (e) {
                log('error', 'Помилка відображення сповіщення', e);
                return false;
            }
        },

        /**
         * Показує модальне вікно підтвердження
         */
        showConfirmation: function(message, onConfirm, onCancel) {
            try {
                // Спробуємо використати існуючу функцію
                if (window.createConfirmDialog) {
                    return window.createConfirmDialog(message, onConfirm, onCancel);
                }

                // Запасний варіант - стандартний confirm
                if (confirm(message)) {
                    if (typeof onConfirm === 'function') {
                        onConfirm();
                    }
                } else {
                    if (typeof onCancel === 'function') {
                        onCancel();
                    }
                }

                return true;
            } catch (e) {
                log('error', 'Помилка відображення вікна підтвердження', e);

                // Запасний варіант - звичайний confirm
                if (confirm(message)) {
                    if (typeof onConfirm === 'function') {
                        onConfirm();
                    }
                } else {
                    if (typeof onCancel === 'function') {
                        onCancel();
                    }
                }

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
                    await syncUserData();
                    log('info', 'Початкова синхронізація з сервером успішна');
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

                    // Використовуємо функцію оновлення стейкінгу з нової системи
                    if (window.WinixStakingSystem && typeof window.WinixStakingSystem.updateStakingDisplay === 'function') {
                        window.WinixStakingSystem.updateStakingDisplay();
                    }
                } catch (e) {
                    log('error', 'Помилка автоматичного оновлення UI', e);
                }
            }, _config.syncInterval);

            // Синхронізуємо дані з сервером кожні 30 секунд
            const serverSyncInterval = 30000; // 30 секунд
            setInterval(() => {
                try {
                    // Синхронізуємо дані з сервера
                    syncUserData().catch(error => {
                        log('error', 'Помилка періодичної синхронізації з сервером', error);
                    });
                } catch (e) {
                    log('error', 'Помилка під час спроби періодичної синхронізації', e);
                }
            }, serverSyncInterval);

            log('info', `Запущено автоматичну синхронізацію UI з інтервалом ${_config.syncInterval}мс`);
            log('info', `Запущено періодичну синхронізацію з сервером з інтервалом 30с`);

            // Додаємо обробник для синхронізації при поверненні на вкладку
            window.addEventListener('focus', () => {
                try {
                    syncUserData().catch(error => {
                        log('error', 'Помилка синхронізації при поверненні на вкладку', error);
                    });
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

            // Використовуємо функцію оновлення стейкінгу з нової системи
            window.updateStakingDisplay = window.WinixStakingSystem && typeof window.WinixStakingSystem.updateStakingDisplay === 'function'
                ? window.WinixStakingSystem.updateStakingDisplay
                : function() { console.log("Функція оновлення стейкінгу недоступна"); };

            window.updateTransactionsList = UIManager.updateTransactionsList;

            log('info', 'Патчі для сумісності успішно застосовано');
        },

        // Експортуємо публічні інтерфейси для зручного доступу
        Balance: BalanceManager,
        Transactions: TransactionManager,
        Referrals: ReferralManager,
        Staking: StakingManager,
        UI: UIManager,

        // Експортуємо константи
        TRANSACTION_TYPES,
        MESSAGE_TYPES,
        STORAGE_KEYS,
        STAKING_CONFIG
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

                // Використовуємо функцію оновлення стейкінгу з нової системи
                if (window.WinixStakingSystem && typeof window.WinixStakingSystem.updateStakingDisplay === 'function') {
                    window.WinixStakingSystem.updateStakingDisplay();
                }

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

                // Використовуємо функцію оновлення стейкінгу з нової системи
                if (window.WinixStakingSystem && typeof window.WinixStakingSystem.updateStakingDisplay === 'function') {
                    window.WinixStakingSystem.updateStakingDisplay();
                }

                UIManager.updateTransactionsList();

                // Відправляємо подію про ініціалізацію
                document.dispatchEvent(new CustomEvent('winix-core-initialized'));
            }, 300);
        }
    }

    // Повертаємо публічний API
    return WinixCore;
})();