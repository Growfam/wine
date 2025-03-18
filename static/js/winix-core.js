/**
 * WinixCore.js - Уніфікована система управління даними WINIX
 *
 * Єдина система для керування балансом, стейкінгом, транзакціями і всіма іншими аспектами
 * додатку WINIX. Вирішує проблеми з конфліктами даних і забезпечує узгодженість між сторінками.
 */

(function() {
    // Запобігаємо повторній ініціалізації
    if (window.WinixCore) {
        console.log("✅ WinixCore вже ініціалізовано");
        return window.WinixCore;
    }

    // --------------- ПРИВАТНІ КОНСТАНТИ ---------------

    // Ключі для localStorage. Всі дані зберігаються під цими ключами
    const STORAGE_KEYS = {
        // Баланси
        USER_TOKENS: 'winix_balance',        // Баланс WINIX токенів
        USER_COINS: 'winix_coins',           // Баланс жетонів

        // Стейкінг
        STAKING_DATA: 'winix_staking',       // Дані активного стейкінгу
        STAKING_HISTORY: 'winix_staking_history', // Історія стейкінгу

        // Транзакції
        TRANSACTIONS: 'winix_transactions',   // Історія транзакцій

        // Реферальна система
        REFERRAL_DATA: 'winix_referral',     // Реферальні дані

        // Метадані
        VERSION: 'winix_version',            // Версія даних
        LAST_SYNC: 'winix_last_sync'         // Остання синхронізація
    };

    // Типи транзакцій
    const TRANSACTION_TYPES = {
        RECEIVE: 'receive',     // Отримання коштів
        SEND: 'send',           // Надсилання коштів
        STAKE: 'stake',         // Стейкінг коштів
        UNSTAKE: 'unstake',     // Розстейкінг коштів
        REWARD: 'reward',       // Нагорода (бонуси, реферали тощо)
        FEE: 'fee'              // Комісія
    };

    // Типи відображення повідомлень
    const MESSAGE_TYPES = {
        SUCCESS: 'success',
        ERROR: 'error',
        INFO: 'info',
        WARNING: 'warning'
    };

    // Відсотки стейкінгу
    const STAKING_RATES = {
        7: 3,    // 3% за 7 днів
        14: 7,   // 7% за 14 днів
        28: 15   // 15% за 28 днів
    };

    // --------------- ПРИВАТНІ ЗМІННІ ---------------

    // Прапорці блокування операцій для уникнення race conditions
    let _isUpdatingBalance = false;
    let _isCreatingStaking = false;
    let _isCancellingStaking = false;
    let _isProcessingTransaction = false;

    // Списки обробників подій
    let _eventListeners = {
        balanceChanged: [],
        stakingChanged: [],
        transactionAdded: [],
        stakingCreated: [],
        stakingCancelled: []
    };

    // Конфігурація системи
    let _config = {
        debug: false,             // Режим налагодження (виводить більше логів)
        autoSync: true,           // Автоматична синхронізація даних
        syncInterval: 5000,       // Інтервал синхронізації (мс)
        stakingCancelFee: 0.2,    // Комісія при скасуванні стейкінгу (20%)
        maxTransactionHistory: 100 // Максимальна кількість збережених транзакцій
    };

    // --------------- ДОПОМІЖНІ ФУНКЦІЇ ---------------

    /**
     * Генерація унікального ID
     * @returns {string} Унікальний ID
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }

    /**
     * Логування з префіксом системи
     * @param {string} type Тип повідомлення (log, error, warn, info)
     * @param {string} message Повідомлення
     * @param {any} data Додаткові дані
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
     * @param {string} json JSON-рядок для парсування
     * @param {any} defaultValue Значення за замовчуванням, якщо парсування не вдалося
     * @returns {any} Результат парсування або значення за замовчуванням
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
     * @param {string} key Ключ
     * @param {any} value Значення для збереження
     * @returns {boolean} Чи успішно збережено
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
     * @param {string} key Ключ
     * @param {any} defaultValue Значення за замовчуванням
     * @param {boolean} parse Чи потрібно парсити JSON
     * @returns {any} Отримане значення або значення за замовчуванням
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
     * @param {string} eventName Назва події
     * @param {any} data Дані події
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
     * Створення міграцій для адаптації старих даних до нової системи
     */
    function migrateOldData() {
        try {
            log('info', 'Запуск міграції старих даних');

            // Міграція балансу
            const oldTokens = parseFloat(localStorage.getItem('userTokens')) || 0;
            const oldCoins = parseFloat(localStorage.getItem('userCoins')) || 0;

            if (oldTokens > 0 && !safeGetItem(STORAGE_KEYS.USER_TOKENS)) {
                log('info', `Міграція старого балансу: ${oldTokens} WINIX`);
                safeSetItem(STORAGE_KEYS.USER_TOKENS, oldTokens.toString());
            }

            if (oldCoins > 0 && !safeGetItem(STORAGE_KEYS.USER_COINS)) {
                log('info', `Міграція старих жетонів: ${oldCoins}`);
                safeSetItem(STORAGE_KEYS.USER_COINS, oldCoins.toString());
            }

            // Міграція даних стейкінгу
            const possibleStakingKeys = ['stakingData', 'winix_stakingData', 'StakingSystem.data'];
            let migratedStaking = false;

            for (const key of possibleStakingKeys) {
                const stakingData = safeGetItem(key, null, true);

                if (stakingData && !migratedStaking && !safeGetItem(STORAGE_KEYS.STAKING_DATA)) {
                    // Перетворюємо на новий формат, якщо потрібно
                    let newStakingData = stakingData;

                    // Різні формати даних стейкінгу
                    if (stakingData.activeStaking && stakingData.activeStaking.length > 0) {
                        // Формат StakingSystem
                        newStakingData = {
                            hasActiveStaking: true,
                            stakingId: stakingData.activeStaking[0].id || generateId(),
                            stakingAmount: stakingData.activeStaking[0].amount || 0,
                            period: stakingData.activeStaking[0].period || 14,
                            rewardPercent: stakingData.activeStaking[0].rewardPercent || 7,
                            expectedReward: stakingData.activeStaking[0].expectedReward || 0,
                            remainingDays: stakingData.activeStaking[0].remainingDays || 0,
                            startDate: stakingData.activeStaking[0].startTime || new Date().toISOString(),
                            endDate: stakingData.activeStaking[0].endTime || new Date().toISOString()
                        };
                    }

                    // Додаємо необхідні поля, якщо вони відсутні
                    if (!newStakingData.stakingId) {
                        newStakingData.stakingId = generateId();
                    }

                    log('info', `Міграція даних стейкінгу з ${key}`);
                    safeSetItem(STORAGE_KEYS.STAKING_DATA, newStakingData);
                    migratedStaking = true;
                }
            }

            // Міграція транзакцій
            const possibleTransactionKeys = ['transactions', 'transactionList', 'winix_wallet_transactions'];
            let migratedTransactions = false;

            for (const key of possibleTransactionKeys) {
                const transactions = safeGetItem(key, null, true);

                if (Array.isArray(transactions) && transactions.length > 0 && !migratedTransactions && !safeGetItem(STORAGE_KEYS.TRANSACTIONS)) {
                    // Перетворення на новий формат
                    const newTransactions = transactions.map(tx => {
                        // Переконуємося, що всі необхідні поля присутні
                        return {
                            id: tx.id || generateId(),
                            type: tx.type || TRANSACTION_TYPES.RECEIVE,
                            amount: parseFloat(tx.amount) || 0,
                            description: tx.description || 'Транзакція',
                            timestamp: tx.timestamp || tx.date || Date.now(),
                            status: tx.status || 'completed'
                        };
                    }).filter(tx => tx.amount > 0); // Видаляємо некоректні транзакції

                    log('info', `Міграція ${newTransactions.length} транзакцій з ${key}`);
                    safeSetItem(STORAGE_KEYS.TRANSACTIONS, newTransactions);
                    migratedTransactions = true;
                }
            }

            // Встановлюємо версію даних після міграції
            safeSetItem(STORAGE_KEYS.VERSION, '1.0.0');
            safeSetItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());

            log('info', 'Міграцію даних завершено');
            return true;
        } catch (e) {
            log('error', 'Помилка під час міграції даних', e);
            return false;
        }
    }

    // --------------- ОСНОВНА СИСТЕМА ---------------

    /**
     * Створюємо обгортку для роботи з балансом
     */
    const BalanceManager = {
        /**
         * Отримання балансу WINIX
         * @returns {number} Поточний баланс
         */
        getTokens: function() {
            const balance = parseFloat(safeGetItem(STORAGE_KEYS.USER_TOKENS, '0'));
            return isNaN(balance) ? 0 : balance;
        },

        /**
         * Отримання балансу жетонів
         * @returns {number} Поточний баланс жетонів
         */
        getCoins: function() {
            const coins = parseFloat(safeGetItem(STORAGE_KEYS.USER_COINS, '0'));
            return isNaN(coins) ? 0 : coins;
        },

        /**
         * Встановлення нового балансу WINIX
         * @param {number} amount Нова сума балансу
         * @returns {boolean} Успішність операції
         */
        setTokens: function(amount) {
            if (_isUpdatingBalance) {
                log('warn', 'Спроба встановити баланс під час іншого оновлення');
                return false;
            }

            _isUpdatingBalance = true;

            try {
                amount = parseFloat(amount);

                if (isNaN(amount) || amount < 0) {
                    log('error', 'Спроба встановити некоректний баланс', amount);
                    return false;
                }

                const oldBalance = this.getTokens();

                // Зберігаємо новий баланс
                safeSetItem(STORAGE_KEYS.USER_TOKENS, amount.toString());

                // Генеруємо подію зміни балансу
                emitEvent('balanceChanged', {
                    oldBalance,
                    newBalance: amount,
                    diff: amount - oldBalance
                });

                log('info', `Баланс встановлено: ${amount} WINIX`);
                return true;
            } catch (e) {
                log('error', 'Помилка встановлення балансу', e);
                return false;
            } finally {
                _isUpdatingBalance = false;
            }
        },

        /**
         * Встановлення балансу жетонів
         * @param {number} amount Нова кількість жетонів
         * @returns {boolean} Успішність операції
         */
        setCoins: function(amount) {
            try {
                amount = parseFloat(amount);

                if (isNaN(amount) || amount < 0) {
                    log('error', 'Спроба встановити некоректну кількість жетонів', amount);
                    return false;
                }

                const oldCoins = this.getCoins();

                // Зберігаємо нову кількість жетонів
                safeSetItem(STORAGE_KEYS.USER_COINS, amount.toString());

                log('info', `Баланс жетонів встановлено: ${amount}`);
                return true;
            } catch (e) {
                log('error', 'Помилка встановлення балансу жетонів', e);
                return false;
            }
        },

        /**
         * Додавання токенів до балансу
         * @param {number} amount Кількість токенів для додавання
         * @param {string} description Опис транзакції
         * @returns {boolean} Успішність операції
         */
        addTokens: function(amount, description = 'Поповнення балансу') {
            if (_isUpdatingBalance) {
                log('warn', 'Спроба додати токени під час іншого оновлення');
                return false;
            }

            _isUpdatingBalance = true;

            try {
                amount = parseFloat(amount);

                if (isNaN(amount) || amount <= 0) {
                    log('error', 'Спроба додати некоректну кількість токенів', amount);
                    return false;
                }

                const currentBalance = this.getTokens();
                const newBalance = currentBalance + amount;

                // Зберігаємо новий баланс
                safeSetItem(STORAGE_KEYS.USER_TOKENS, newBalance.toString());

                // Додаємо транзакцію
                TransactionManager.addTransaction(
                    TRANSACTION_TYPES.RECEIVE,
                    amount,
                    description
                );

                // Генеруємо подію зміни балансу
                emitEvent('balanceChanged', {
                    oldBalance: currentBalance,
                    newBalance,
                    diff: amount
                });

                log('info', `Додано ${amount} WINIX до балансу. Новий баланс: ${newBalance}`);
                return true;
            } catch (e) {
                log('error', 'Помилка додавання токенів', e);
                return false;
            } finally {
                _isUpdatingBalance = false;
            }
        },

        /**
         * Зняття токенів з балансу
         * @param {number} amount Кількість токенів для зняття
         * @param {string} description Опис транзакції
         * @returns {boolean} Успішність операції
         */
        subtractTokens: function(amount, description = 'Зняття коштів') {
            if (_isUpdatingBalance) {
                log('warn', 'Спроба зняти токени під час іншого оновлення');
                return false;
            }

            _isUpdatingBalance = true;

            try {
                amount = parseFloat(amount);

                if (isNaN(amount) || amount <= 0) {
                    log('error', 'Спроба зняти некоректну кількість токенів', amount);
                    return false;
                }

                const currentBalance = this.getTokens();

                // Перевіряємо, чи достатньо коштів
                if (currentBalance < amount) {
                    log('error', 'Недостатньо коштів для зняття', {
                        balance: currentBalance,
                        amount
                    });
                    return false;
                }

                const newBalance = currentBalance - amount;

                // Зберігаємо новий баланс
                safeSetItem(STORAGE_KEYS.USER_TOKENS, newBalance.toString());

                // Додаємо транзакцію
                TransactionManager.addTransaction(
                    TRANSACTION_TYPES.SEND,
                    amount,
                    description
                );

                // Генеруємо подію зміни балансу
                emitEvent('balanceChanged', {
                    oldBalance: currentBalance,
                    newBalance,
                    diff: -amount
                });

                log('info', `Знято ${amount} WINIX з балансу. Новий баланс: ${newBalance}`);
                return true;
            } catch (e) {
                log('error', 'Помилка зняття токенів', e);
                return false;
            } finally {
                _isUpdatingBalance = false;
            }
        },

        /**
         * Додавання жетонів до балансу
         * @param {number} amount Кількість жетонів для додавання
         * @returns {boolean} Успішність операції
         */
        addCoins: function(amount) {
            try {
                amount = parseFloat(amount);

                if (isNaN(amount) || amount <= 0) {
                    log('error', 'Спроба додати некоректну кількість жетонів', amount);
                    return false;
                }

                const currentCoins = this.getCoins();
                const newCoins = currentCoins + amount;

                // Зберігаємо нову кількість жетонів
                safeSetItem(STORAGE_KEYS.USER_COINS, newCoins.toString());

                log('info', `Додано ${amount} жетонів. Новий баланс: ${newCoins}`);
                return true;
            } catch (e) {
                log('error', 'Помилка додавання жетонів', e);
                return false;
            }
        },

        /**
         * Зняття жетонів з балансу
         * @param {number} amount Кількість жетонів для зняття
         * @returns {boolean} Успішність операції
         */
        subtractCoins: function(amount) {
            try {
                amount = parseFloat(amount);

                if (isNaN(amount) || amount <= 0) {
                    log('error', 'Спроба зняти некоректну кількість жетонів', amount);
                    return false;
                }

                const currentCoins = this.getCoins();

                // Перевіряємо, чи достатньо жетонів
                if (currentCoins < amount) {
                    log('error', 'Недостатньо жетонів для зняття', {
                        coins: currentCoins,
                        amount
                    });
                    return false;
                }

                const newCoins = currentCoins - amount;

                // Зберігаємо нову кількість жетонів
                safeSetItem(STORAGE_KEYS.USER_COINS, newCoins.toString());

                log('info', `Знято ${amount} жетонів. Новий баланс: ${newCoins}`);
                return true;
            } catch (e) {
                log('error', 'Помилка зняття жетонів', e);
                return false;
            }
        }
    };

    /**
     * Створюємо обгортку для роботи зі стейкінгом
     */
    const StakingManager = {
        /**
         * Перевірка наявності активного стейкінгу
         * @returns {boolean} Чи є активний стейкінг
         */
        hasActiveStaking: function() {
            const stakingData = this.getStakingData();
            return stakingData && stakingData.hasActiveStaking === true;
        },

        /**
         * Отримання даних активного стейкінгу
         * @returns {Object|null} Дані стейкінгу або null, якщо стейкінгу немає
         */
        getStakingData: function() {
            const data = safeGetItem(STORAGE_KEYS.STAKING_DATA, null, true);

            if (!data || data.hasActiveStaking !== true) {
                return {
                    hasActiveStaking: false,
                    stakingAmount: 0,
                    rewardPercent: 0,
                    expectedReward: 0,
                    remainingDays: 0
                };
            }

            // Перевіряємо статус стейкінгу
            if (data.hasActiveStaking && data.endDate) {
                const endDate = new Date(data.endDate);
                const now = new Date();

                // Якщо стейкінг завершився, автоматично нараховуємо винагороду
                if (now >= endDate) {
                    log('info', 'Стейкінг завершено, нараховуємо винагороду');
                    this._finalizeStaking(data);
                    return {
                        hasActiveStaking: false,
                        stakingAmount: 0,
                        rewardPercent: 0,
                        expectedReward: 0,
                        remainingDays: 0
                    };
                }

                // Оновлюємо кількість днів, що залишилась
                const diffTime = endDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                data.remainingDays = Math.max(0, diffDays);

                // Зберігаємо оновлені дані
                safeSetItem(STORAGE_KEYS.STAKING_DATA, data);
            }

            return data;
        },

        /**
         * Автоматичне нарахування винагороди при завершенні стейкінгу
         * @param {Object} stakingData Дані стейкінгу
         * @returns {boolean} Успішність операції
         * @private
         */
        _finalizeStaking: function(stakingData) {
            try {
                if (!stakingData || !stakingData.hasActiveStaking) {
                    return false;
                }

                // Рахуємо загальну суму (стейкінг + винагорода)
                const totalAmount = stakingData.stakingAmount + stakingData.expectedReward;

                // Додаємо суму до балансу
                BalanceManager.addTokens(
                    totalAmount,
                    `Стейкінг завершено: ${stakingData.stakingAmount} + ${stakingData.expectedReward} винагорода`
                );

                // Зберігаємо стейкінг в історії
                const historyEntry = {
                    ...stakingData,
                    completedDate: new Date().toISOString(),
                    totalReturned: totalAmount,
                    status: 'completed'
                };

                this._addToStakingHistory(historyEntry);

                // Очищаємо дані активного стейкінгу
                safeSetItem(STORAGE_KEYS.STAKING_DATA, {
                    hasActiveStaking: false,
                    stakingAmount: 0,
                    rewardPercent: 0,
                    expectedReward: 0,
                    remainingDays: 0
                });

                log('info', 'Стейкінг успішно завершено', {
                    stakingAmount: stakingData.stakingAmount,
                    reward: stakingData.expectedReward,
                    total: totalAmount
                });

                return true;
            } catch (e) {
                log('error', 'Помилка завершення стейкінгу', e);
                return false;
            }
        },

        /**
         * Додавання запису до історії стейкінгу
         * @param {Object} entry Запис для додавання
         * @returns {boolean} Успішність операції
         * @private
         */
        _addToStakingHistory: function(entry) {
            try {
                // Отримуємо поточну історію
                const history = safeGetItem(STORAGE_KEYS.STAKING_HISTORY, [], true);

                // Додаємо новий запис
                history.unshift(entry);

                // Обмежуємо розмір історії (зберігаємо останні 20 записів)
                const trimmedHistory = history.slice(0, 20);

                // Зберігаємо оновлену історію
                safeSetItem(STORAGE_KEYS.STAKING_HISTORY, trimmedHistory);

                return true;
            } catch (e) {
                log('error', 'Помилка додавання запису до історії стейкінгу', e);
                return false;
            }
        },

        /**
         * Розрахунок очікуваної винагороди за стейкінг
         * @param {number} amount Сума стейкінгу
         * @param {number} period Період стейкінгу (днів)
         * @returns {number} Очікувана винагорода
         */
        calculateExpectedReward: function(amount, period) {
            try {
                amount = parseFloat(amount);
                period = parseInt(period);

                if (isNaN(amount) || amount <= 0 || isNaN(period) || period <= 0) {
                    return 0;
                }

                // Отримуємо відсоток для обраного періоду
                const rewardPercent = STAKING_RATES[period] || 7; // За замовчуванням 7%

                // Розраховуємо винагороду
                const reward = amount * (rewardPercent / 100);

                return parseFloat(reward.toFixed(2));
            } catch (e) {
                log('error', 'Помилка розрахунку винагороди', e);
                return 0;
            }
        },

        /**
         * Створення нового стейкінгу
         * @param {number} amount Сума стейкінгу
         * @param {number} period Період стейкінгу (днів)
         * @returns {Object} Результат операції
         */
        createStaking: function(amount, period) {
            if (_isCreatingStaking) {
                log('warn', 'Вже виконується створення стейкінгу');
                return {
                    success: false,
                    message: 'Операція вже виконується'
                };
            }

            _isCreatingStaking = true;

            try {
                amount = parseFloat(amount);
                period = parseInt(period);

                // Перевірка коректності параметрів
                if (isNaN(amount) || amount <= 0) {
                    return {
                        success: false,
                        message: 'Некоректна сума стейкінгу'
                    };
                }

                if (isNaN(period) || ![7, 14, 28].includes(period)) {
                    return {
                        success: false,
                        message: 'Некоректний період стейкінгу'
                    };
                }

                // Перевіряємо, чи є вже активний стейкінг
                if (this.hasActiveStaking()) {
                    return {
                        success: false,
                        message: 'У вас вже є активний стейкінг'
                    };
                }

                // Перевіряємо, чи достатньо коштів
                const balance = BalanceManager.getTokens();
                if (balance < amount) {
                    return {
                        success: false,
                        message: `Недостатньо коштів. Ваш баланс: ${balance.toFixed(2)} WINIX`
                    };
                }

                // Визначаємо відсоток відповідно до періоду
                const rewardPercent = STAKING_RATES[period] || 7;

                // Розрахунок очікуваної винагороди
                const expectedReward = this.calculateExpectedReward(amount, period);

                // Перевірка адекватності винагороди
                if (expectedReward > amount * 0.2) {
                    log('warn', 'Підозріло висока винагорода за стейкінг', {
                        amount,
                        period,
                        reward: expectedReward
                    });
                }

                // Знімаємо кошти з балансу
                const subtracted = BalanceManager.subtractTokens(
                    amount,
                    `Стейкінг на ${period} днів (${rewardPercent}%)`
                );

                if (!subtracted) {
                    return {
                        success: false,
                        message: 'Помилка списання коштів'
                    };
                }

                // Створюємо дані стейкінгу
                const currentDate = new Date();
                const endDate = new Date(currentDate);
                endDate.setDate(endDate.getDate() + period);

                const stakingId = generateId();

                const stakingData = {
                    hasActiveStaking: true,
                    stakingId,
                    stakingAmount: amount,
                    period,
                    rewardPercent,
                    expectedReward,
                    remainingDays: period,
                    startDate: currentDate.toISOString(),
                    endDate: endDate.toISOString(),
                    creationTimestamp: Date.now()
                };

                // Зберігаємо дані стейкінгу
                safeSetItem(STORAGE_KEYS.STAKING_DATA, stakingData);

                // Додаємо транзакцію стейкінгу
                TransactionManager.addTransaction(
                    TRANSACTION_TYPES.STAKE,
                    amount,
                    `Стейкінг на ${period} днів (${rewardPercent}%)`
                );

                // Генеруємо подію створення стейкінгу
                emitEvent('stakingCreated', stakingData);

                log('info', 'Стейкінг успішно створено', stakingData);

                return {
                    success: true,
                    message: 'Стейкінг успішно створено',
                    data: stakingData
                };
            } catch (e) {
                log('error', 'Помилка створення стейкінгу', e);
                return {
                    success: false,
                    message: 'Внутрішня помилка при створенні стейкінгу'
                };
            } finally {
                _isCreatingStaking = false;
            }
        },

        /**
         * Додавання коштів до існуючого стейкінгу
         * @param {number} amount Сума для додавання
         * @returns {Object} Результат операції
         */
        addToStaking: function(amount) {
            try {
                amount = parseFloat(amount);

                // Перевірка коректності параметрів
                if (isNaN(amount) || amount <= 0) {
                    return {
                        success: false,
                        message: 'Некоректна сума для додавання'
                    };
                }

                // Перевіряємо наявність активного стейкінгу
                if (!this.hasActiveStaking()) {
                    return {
                        success: false,
                        message: 'У вас немає активного стейкінгу'
                    };
                }

                // Перевіряємо, чи достатньо коштів
                const balance = BalanceManager.getTokens();
                if (balance < amount) {
                    return {
                        success: false,
                        message: `Недостатньо коштів. Ваш баланс: ${balance.toFixed(2)} WINIX`
                    };
                }

                // Отримуємо поточні дані стейкінгу
                const stakingData = this.getStakingData();

                // Знімаємо кошти з балансу
                const subtracted = BalanceManager.subtractTokens(
                    amount,
                    'Додавання до стейкінгу'
                );

                if (!subtracted) {
                    return {
                        success: false,
                        message: 'Помилка списання коштів'
                    };
                }

                // Оновлюємо дані стейкінгу
                const newAmount = stakingData.stakingAmount + amount;
                stakingData.stakingAmount = newAmount;
                stakingData.expectedReward = this.calculateExpectedReward(
                    newAmount,
                    stakingData.period
                );

                // Зберігаємо оновлені дані
                safeSetItem(STORAGE_KEYS.STAKING_DATA, stakingData);

                // Додаємо транзакцію
                TransactionManager.addTransaction(
                    TRANSACTION_TYPES.STAKE,
                    amount,
                    'Додавання до стейкінгу'
                );

                // Генеруємо подію зміни стейкінгу
                emitEvent('stakingChanged', stakingData);

                log('info', 'Кошти успішно додано до стейкінгу', {
                    addedAmount: amount,
                    newAmount,
                    stakingData
                });

                return {
                    success: true,
                    message: `Додано ${amount.toFixed(2)} WINIX до стейкінгу`,
                    data: stakingData
                };
            } catch (e) {
                log('error', 'Помилка додавання до стейкінгу', e);
                return {
                    success: false,
                    message: 'Внутрішня помилка при додаванні до стейкінгу'
                };
            }
        },

        /**
         * Скасування стейкінгу
         * @returns {Object} Результат операції
         */
        cancelStaking: function() {
            if (_isCancellingStaking) {
                log('warn', 'Вже виконується скасування стейкінгу');
                return {
                    success: false,
                    message: 'Операція вже виконується'
                };
            }

            _isCancellingStaking = true;

            try {
                // Перевіряємо наявність активного стейкінгу
                if (!this.hasActiveStaking()) {
                    return {
                        success: false,
                        message: 'У вас немає активного стейкінгу'
                    };
                }

                // Отримуємо дані стейкінгу
                const stakingData = this.getStakingData();

                // Розраховуємо суму для повернення (80% від суми стейкінгу)
                const returnAmount = stakingData.stakingAmount * (1 - _config.stakingCancelFee);
                const feeAmount = stakingData.stakingAmount * _config.stakingCancelFee;

                // Зберігаємо в історії
                const historyEntry = {
                    ...stakingData,
                    cancelledDate: new Date().toISOString(),
                    returnedAmount: returnAmount,
                    feeAmount,
                    status: 'cancelled'
                };

                this._addToStakingHistory(historyEntry);

                // Очищаємо дані стейкінгу
                safeSetItem(STORAGE_KEYS.STAKING_DATA, {
                    hasActiveStaking: false,
                    stakingAmount: 0,
                    rewardPercent: 0,
                    expectedReward: 0,
                    remainingDays: 0
                });

                // Додаємо повернуті кошти на баланс
                BalanceManager.addTokens(
                    returnAmount,
                    `Стейкінг скасовано (утримано ${(_config.stakingCancelFee * 100).toFixed(0)}% як штраф)`
                );

                // Генеруємо подію скасування стейкінгу
                emitEvent('stakingCancelled', {
                    stakingAmount: stakingData.stakingAmount,
                    returnAmount,
                    feeAmount,
                    feePercentage: _config.stakingCancelFee * 100
                });

                log('info', 'Стейкінг успішно скасовано', {
                    stakingAmount: stakingData.stakingAmount,
                    returnAmount,
                    feeAmount
                });

                return {
                    success: true,
                    message: `Стейкінг скасовано. Повернено ${returnAmount.toFixed(2)} WINIX (утримано ${(_config.stakingCancelFee * 100).toFixed(0)}% як штраф)`,
                    data: {
                        returnAmount,
                        feeAmount,
                        feePercentage: _config.stakingCancelFee * 100
                    }
                };
            } catch (e) {
                log('error', 'Помилка скасування стейкінгу', e);
                return {
                    success: false,
                    message: 'Внутрішня помилка при скасуванні стейкінгу'
                };
            } finally {
                _isCancellingStaking = false;
            }
        },

        /**
         * Отримання історії стейкінгу
         * @param {number} limit Кількість записів для отримання
         * @returns {Array} Історія стейкінгу
         */
        getStakingHistory: function(limit = 0) {
            const history = safeGetItem(STORAGE_KEYS.STAKING_HISTORY, [], true);

            if (limit > 0 && history.length > limit) {
                return history.slice(0, limit);
            }

            return history;
        }
    };

    /**
     * Створюємо обгортку для роботи з транзакціями
     */
    const TransactionManager = {
        /**
         * Додавання нової транзакції
         * @param {string} type Тип транзакції
         * @param {number} amount Сума транзакції
         * @param {string} description Опис транзакції
         * @returns {Object} Результат операції
         */
        addTransaction: function(type, amount, description = '') {
            if (_isProcessingTransaction) {
                log('warn', 'Вже обробляється інша транзакція');
                return {
                    success: false,
                    message: 'Операція вже виконується'
                };
            }

            _isProcessingTransaction = true;

            try {
                // Валідація параметрів
                amount = parseFloat(amount);

                if (isNaN(amount) || amount <= 0) {
                    log('error', 'Некоректна сума транзакції', amount);
                    return {
                        success: false,
                        message: 'Некоректна сума транзакції'
                    };
                }

                if (!Object.values(TRANSACTION_TYPES).includes(type)) {
                    log('error', 'Некоректний тип транзакції', type);
                    return {
                        success: false,
                        message: 'Некоректний тип транзакції'
                    };
                }

                // Отримуємо поточний список транзакцій
                const transactions = this.getTransactions();

                // Створюємо нову транзакцію
                const newTransaction = {
                    id: generateId(),
                    type,
                    amount,
                    description: description || this._getDefaultDescription(type),
                    timestamp: Date.now(),
                    status: 'completed'
                };

                // Додаємо транзакцію на початок списку
                transactions.unshift(newTransaction);

                // Обмежуємо розмір списку
                const trimmedTransactions = transactions.slice(
                    0,
                    _config.maxTransactionHistory
                );

                // Зберігаємо список транзакцій
                safeSetItem(STORAGE_KEYS.TRANSACTIONS, trimmedTransactions);

                // Генеруємо подію додавання транзакції
                emitEvent('transactionAdded', newTransaction);

                log('info', 'Додано нову транзакцію', newTransaction);

                return {
                    success: true,
                    transaction: newTransaction
                };
            } catch (e) {
                log('error', 'Помилка додавання транзакції', e);
                return {
                    success: false,
                    message: 'Внутрішня помилка при додаванні транзакції'
                };
            } finally {
                _isProcessingTransaction = false;
            }
        },

        /**
         * Отримання всіх транзакцій
         * @returns {Array} Список транзакцій
         */
        getTransactions: function() {
            return safeGetItem(STORAGE_KEYS.TRANSACTIONS, [], true);
        },

        /**
         * Отримання останніх транзакцій
         * @param {number} limit Кількість транзакцій
         * @returns {Array} Список останніх транзакцій
         */
        getRecentTransactions: function(limit = 3) {
            const transactions = this.getTransactions();
            return transactions.slice(0, limit);
        },

        /**
         * Отримання транзакцій за типом
         * @param {string} type Тип транзакцій
         * @returns {Array} Список транзакцій вказаного типу
         */
        getTransactionsByType: function(type) {
            const transactions = this.getTransactions();
            return transactions.filter(tx => tx.type === type);
        },

        /**
         * Отримання транзакції за ID
         * @param {string} id ID транзакції
         * @returns {Object|null} Транзакція або null, якщо не знайдено
         */
        getTransactionById: function(id) {
            const transactions = this.getTransactions();
            return transactions.find(tx => tx.id === id) || null;
        },

        /**
         * Отримання опису за замовчуванням для типу транзакції
         * @param {string} type Тип транзакції
         * @returns {string} Опис за замовчуванням
         * @private
         */
        _getDefaultDescription: function(type) {
            switch (type) {
                case TRANSACTION_TYPES.RECEIVE:
                    return 'Отримання коштів';
                case TRANSACTION_TYPES.SEND:
                    return 'Відправлення коштів';
                case TRANSACTION_TYPES.STAKE:
                    return 'Стейкінг коштів';
                case TRANSACTION_TYPES.UNSTAKE:
                    return 'Повернення зі стейкінгу';
                case TRANSACTION_TYPES.REWARD:
                    return 'Отримання винагороди';
                case TRANSACTION_TYPES.FEE:
                    return 'Комісія за операцію';
                default:
                    return 'Транзакція';
            }
        },

        /**
         * Отримання тексту для типу транзакції
         * @param {string} type Тип транзакції
         * @returns {string} Текст транзакції
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
         * @param {string} type Тип транзакції
         * @returns {string} Клас CSS
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
         * @param {string} type Тип транзакції
         * @returns {string} Префікс
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
     * Створюємо обгортку для роботи з реферальною системою
     */
    const ReferralManager = {
        /**
         * Отримання реферальних даних
         * @returns {Object} Реферальні дані
         */
        getReferralData: function() {
            return safeGetItem(STORAGE_KEYS.REFERRAL_DATA, {
                referralCode: this._generateReferralCode(),
                referrerId: null,
                referrals: [],
                rewards: 0
            }, true);
        },

        /**
         * Генерація унікального реферального коду
         * @returns {string} Реферальний код
         * @private
         */
        _generateReferralCode: function() {
            const prefix = 'ref';
            const randomPart = Math.random().toString(36).substring(2, 8);
            const timestamp = Date.now().toString(36).substring(-4);
            return prefix + randomPart + timestamp;
        },

        /**
         * Отримання реферального посилання
         * @returns {string} Реферальне посилання
         */
        getReferralLink: function() {
            const referralData = this.getReferralData();
            return `https://t.me/winix_bot?start=${referralData.referralCode}`;
        },

        /**
         * Нарахування реферальної винагороди
         * @param {string} referrerId ID реферала
         * @param {number} amount Сума основної операції
         * @returns {boolean} Успішність операції
         */
        processReferralReward: function(referrerId, amount) {
            try {
                if (!referrerId) return false;

                // Отримуємо дані реферала
                const referralData = safeGetItem(STORAGE_KEYS.REFERRAL_DATA, null, true);

                if (!referralData) return false;

                // Нараховуємо 10% від суми операції
                const rewardAmount = amount * 0.1;

                // Додаємо винагороду до балансу
                BalanceManager.addTokens(
                    rewardAmount,
                    'Реферальна винагорода'
                );

                // Оновлюємо реферальні дані
                referralData.rewards += rewardAmount;
                safeSetItem(STORAGE_KEYS.REFERRAL_DATA, referralData);

                log('info', 'Нараховано реферальну винагороду', {
                    referrerId,
                    amount,
                    reward: rewardAmount
                });

                return true;
            } catch (e) {
                log('error', 'Помилка нарахування реферальної винагороди', e);
                return false;
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
         * @param {string} elementId ID елемента списку транзакцій
         * @param {number} limit Кількість транзакцій для відображення
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
         * @param {string} message Текст сповіщення
         * @param {string} type Тип сповіщення
         * @param {Function} callback Функція зворотного виклику
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
         * @param {Object} config Конфігурація системи
         */
        init: function(config = {}) {
            try {
                log('info', 'Ініціалізація WinixCore');

                // Оновлюємо конфігурацію
                Object.assign(_config, config);

                // Мігруємо старі дані
                migrateOldData();

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
                    log('error', 'Помилка автоматичного оновлення', e);
                }
            }, _config.syncInterval);

            log('info', `Запущено автоматичну синхронізацію з інтервалом ${_config.syncInterval}мс`);
        },

        /**
         * Встановлення обробника події
         * @param {string} eventName Назва події
         * @param {Function} callback Функція зворотного виклику
         */
        on: function(eventName, callback) {
            if (!_eventListeners[eventName]) {
                _eventListeners[eventName] = [];
            }

            _eventListeners[eventName].push(callback);

            log('info', `Додано обробник події ${eventName}`);
            return this;
        },

        /**
         * Видалення обробника події
         * @param {string} eventName Назва події
         * @param {Function} callback Функція зворотного виклику
         */
        off: function(eventName, callback) {
            if (!_eventListeners[eventName]) return this;

            _eventListeners[eventName] = _eventListeners[eventName].filter(
                cb => cb !== callback
            );

            log('info', `Видалено обробник події ${eventName}`);
            return this;
        },

        /**
         * Застосування патчів для сумісності з іншими системами
         * @private
         */
        _applyCompatibilityPatches: function() {
            log('info', 'Застосування патчів для сумісності з іншими системами');

            // Патч для старої RewardSystem
            if (!window.rewardSystem) {
                window.rewardSystem = {
                    getUserTokens: BalanceManager.getTokens,
                    getUserCoins: BalanceManager.getCoins,
                    setUserTokens: BalanceManager.setTokens,
                    setUserCoins: BalanceManager.setCoins,
                    addTokens: BalanceManager.addTokens,
                    subtractTokens: BalanceManager.subtractTokens,
                    addCoins: BalanceManager.addCoins,
                    reward: function(actionId, tokens, coins) {
                        if (tokens > 0) BalanceManager.addTokens(tokens, `Винагорода: ${actionId}`);
                        if (coins > 0) BalanceManager.addCoins(coins);
                        return true;
                    },
                    updateBalanceDisplay: UIManager.updateBalanceDisplay
                };
            }

            // Патч для StakingSystem
            if (!window.stakingSystem) {
                window.stakingSystem = {
                    hasActiveStaking: StakingManager.hasActiveStaking,
                    getStakingDisplayData: StakingManager.getStakingData,
                    getStakingHistory: StakingManager.getStakingHistory,
                    calculateExpectedReward: StakingManager.calculateExpectedReward,
                    calculatePotentialReward: StakingManager.calculateExpectedReward,
                    createStaking: function(amount, period) {
                        const result = StakingManager.createStaking(amount, period);

                        if (result.success) {
                            UIManager.updateStakingDisplay();
                            UIManager.showNotification('Стейкінг успішно створено');
                        } else {
                            UIManager.showNotification(result.message, MESSAGE_TYPES.ERROR);
                        }

                        return result;
                    },
                    cancelStaking: function() {
                        const result = StakingManager.cancelStaking();

                        if (result.success) {
                            UIManager.updateStakingDisplay();
                            UIManager.showNotification(result.message);
                        } else {
                            UIManager.showNotification(result.message, MESSAGE_TYPES.ERROR);
                        }

                        return result;
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
                    getTransactionsByType: TransactionManager.getTransactionsByType,
                    getTransactionById: TransactionManager.getTransactionById,
                    addTransaction: function(type, amount, description) {
                        return TransactionManager.addTransaction(type, amount, description).success;
                    },
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
        Referrals: ReferralManager,
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
        WinixCore.init();

        log('info', 'WinixCore автоматично ініціалізовано при завантаженні сторінки');

        // Оновлюємо відображення після завантаження
        setTimeout(function() {
            UIManager.updateBalanceDisplay();
            UIManager.updateStakingDisplay();
            UIManager.updateTransactionsList();
        }, 500);
    });

    // Повертаємо публічний API
    return WinixCore;
})();nslookup winixbot.com