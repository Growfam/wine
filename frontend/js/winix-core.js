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
     * Функція для валідації суми стейкінгу
     */
    function validateStakingAmount(amount, balance) {
        // Перевірка на число
        if (isNaN(amount) || amount <= 0) {
            return {
                isValid: false,
                message: "Введіть коректну суму більше нуля"
            };
        }

        // Перевірка, що сума є цілим числом
        if (amount !== Math.floor(amount)) {
            return {
                isValid: false,
                message: "Сума стейкінгу має бути цілим числом"
            };
        }

        // Перевірка на мінімальну суму
        if (amount < STAKING_CONFIG.minAmount) {
            return {
                isValid: false,
                message: `Мінімальна сума стейкінгу: ${STAKING_CONFIG.minAmount} WINIX`
            };
        }

        // Перевірка на максимальну суму відносно балансу
        const maxAllowedAmount = Math.floor(balance * STAKING_CONFIG.maxBalancePercentage);
        if (amount > maxAllowedAmount) {
            return {
                isValid: false,
                message: `Максимальна сума: ${maxAllowedAmount} WINIX (${STAKING_CONFIG.maxBalancePercentage*100}% від балансу)`
            };
        }

        // Перевірка на достатність балансу
        if (amount > balance) {
            return {
                isValid: false,
                message: `Недостатньо коштів. Ваш баланс: ${balance} WINIX`
            };
        }

        return {
            isValid: true,
            message: ""
        };
    }

    /**
 * Виконання API-запиту з обробкою помилок та повторними спробами
 * @param {string} endpoint - URL для запиту
 * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
 * @param {Object} data - Дані для відправки (для POST/PUT запитів)
 * @param {Object} options - Додаткові параметри запиту
 * @param {number} retries - Кількість повторних спроб при помилці
 * @returns {Promise<Object>} Результат запиту у форматі JSON
 */
async function apiRequest(endpoint, method = 'GET', data = null, options = {}, retries = 3) {
    // Отримуємо ID користувача з покращеною функцією
    const userId = getUserId();

    if (!userId) {
        console.error('⚠️ API-запит неможливий: ID користувача не знайдено');
        throw new Error('ID користувача не знайдено');
    }

    // Додаємо мітку часу для запобігання кешуванню
    const timestamp = Date.now();
    const url = endpoint.includes('?')
        ? `${endpoint}&t=${timestamp}`
        : `${endpoint}?t=${timestamp}`;

    // Підготовка параметрів запиту
    const requestOptions = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'X-Telegram-User-Id': userId,
            ...options.headers
        },
        ...options
    };

    // Додаємо тіло запиту для POST/PUT
    if (data && ['POST', 'PUT'].includes(method.toUpperCase())) {
        requestOptions.body = JSON.stringify(data);
    }

    // Функція для повторного запиту при помилці
    async function tryRequest(attemptsLeft) {
        try {
            console.log(`🔄 Відправка ${method} запиту на ${url}`);

            const response = await fetch(url, requestOptions);

            // Перевіряємо статус відповіді
            if (!response.ok) {
                const statusText = response.statusText || '';
                console.error(`❌ Помилка API-запиту: ${response.status} ${statusText}`);

                // Для 401/403 помилок авторизації очищаємо локальне сховище
                if (response.status === 401 || response.status === 403) {
                    console.warn('🔐 Помилка авторизації, спроба оновити дані користувача');
                }

                // Для 404 помилок виводимо детальнішу інформацію
                if (response.status === 404) {
                    console.error(`⚠️ Ресурс не знайдено: ${url}`);
                    throw new Error(`Запитаний ресурс недоступний (404)`);
                }

                // Якщо залишились спроби, повторюємо запит
                if (attemptsLeft > 0) {
                    const delay = Math.pow(2, retries - attemptsLeft) * 500; // Експоненційна затримка
                    console.log(`⏱️ Повтор запиту через ${delay}мс (залишилось спроб: ${attemptsLeft})`);

                    await new Promise(resolve => setTimeout(resolve, delay));
                    return tryRequest(attemptsLeft - 1);
                }

                throw new Error(`Помилка сервера: ${response.status} ${statusText}`);
            }

            // Якщо статус ОК, парсимо JSON
            let jsonData;
            try {
                jsonData = await response.json();
            } catch (parseError) {
                console.error('❌ Помилка парсингу JSON відповіді:', parseError);
                throw new Error('Некоректний формат відповіді');
            }

            // Перевіряємо, чи є помилка у відповіді
            if (jsonData && jsonData.status === 'error') {
                console.error('❌ API повернув помилку:', jsonData.message);
                throw new Error(jsonData.message || 'Помилка виконання запиту');
            }

            console.log(`✅ Успішний API-запит на ${url}`);
            return jsonData;

        } catch (error) {
            // Для мережевих помилок пробуємо ще раз
            if (error.name === 'TypeError' && attemptsLeft > 0) {
                const delay = Math.pow(2, retries - attemptsLeft) * 500;
                console.log(`⚠️ Мережева помилка, повтор через ${delay}мс (залишилось спроб: ${attemptsLeft}):`, error.message);

                await new Promise(resolve => setTimeout(resolve, delay));
                return tryRequest(attemptsLeft - 1);
            }

            // Якщо всі спроби вичерпані, пробуємо оновити інформацію про користувача і рейтимо помилку
            throw error;
        }
    }

    // Починаємо процес запиту з повторними спробами
    return tryRequest(retries);
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
        },

        /**
         * Додавання токенів до балансу користувача через API
         * @param {number} amount - Кількість токенів
         * @param {string} description - Опис транзакції
         */
        addTokens: async function(amount, description = 'Додавання токенів') {
            try {
                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) {
                    log('error', 'Не знайдено ID користувача');
                    return false;
                }

                const data = await apiRequest(`/api/user/${userId}/add-tokens`, 'POST', {
                    amount: amount,
                    description: description
                });

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
                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) {
                    log('error', 'Не знайдено ID користувача');
                    return false;
                }

                const data = await apiRequest(`/api/user/${userId}/subtract-tokens`, 'POST', {
                    amount: amount,
                    description: description
                });

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
                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) {
                    log('error', 'Не знайдено ID користувача');
                    return false;
                }

                const data = await apiRequest(`/api/user/${userId}/add-coins`, 'POST', {
                    amount: amount
                });

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
                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) {
                    log('error', 'Не знайдено ID користувача');
                    return false;
                }

                const data = await apiRequest(`/api/user/${userId}/subtract-coins`, 'POST', {
                    amount: amount
                });

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
                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) {
                    log('error', 'Не знайдено ID користувача');
                    return false;
                }

                const data = await apiRequest(`/api/user/${userId}/convert-coins`, 'POST', {
                    coins_amount: coinsAmount
                });

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

                // Якщо локальна перевірка не пройшла, запитуємо сервер
                const userId = localStorage.getItem('telegram_user_id') ||
                              (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

                if (!userId) {
                    return { success: false, message: 'Не знайдено ID користувача' };
                }

                const data = await apiRequest(`/api/user/${userId}/check-funds`, 'POST', {
                    amount: amount,
                    type: type
                });

                if (data && data.status === 'success') {
                    return { success: true, data: data.data };
                }

                return { success: false, message: 'Помилка перевірки коштів' };
            } catch (error) {
                log('error', 'Помилка перевірки достатності коштів', error);
                return { success: false, message: error.message };
            }
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
     * Відображення сповіщення в стилі WINIX
     */
    showNotification: function(message, type = 'success', callback = null) {
        try {
            // Видаляємо існуючі сповіщення
            const existingNotifications = document.querySelectorAll('.winix-notification');
            existingNotifications.forEach(notification => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            });

            // Визначаємо кольори залежно від типу
            let gradientColors;
            switch (type) {
                case 'success':
                    gradientColors = 'linear-gradient(135deg, #00BFA5, #00CFBB)';
                    break;
                case 'error':
                    gradientColors = 'linear-gradient(135deg, #FF3B58, #FF5C5C)';
                    break;
                case 'warning':
                    gradientColors = 'linear-gradient(135deg, #FFA000, #FFB300)';
                    break;
                case 'info':
                    gradientColors = 'linear-gradient(135deg, #2196F3, #03A9F4)';
                    break;
                default:
                    gradientColors = 'linear-gradient(135deg, #00BFA5, #00CFBB)';
            }

            // Створюємо елемент сповіщення
            const notification = document.createElement('div');
            notification.className = `winix-notification winix-notification-${type}`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                max-width: 80%;
                padding: 12px 20px;
                border-radius: 10px;
                font-weight: 500;
                font-size: 16px;
                z-index: 9999;
                opacity: 0;
                transform: translateY(-20px);
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                color: white;
                background: ${gradientColors};
            `;

            notification.textContent = message;
            document.body.appendChild(notification);

            // Запускаємо анімацію показу
            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateY(0)';
            }, 10);

            // Автоматично приховуємо через 3 секунди
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(-20px)';

                // Видаляємо елемент після анімації
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }

                    // Викликаємо callback після закриття
                    if (typeof callback === 'function') {
                        callback();
                    }
                }, 300);
            }, 3000);

            return true;
        } catch (e) {
            log('error', 'Помилка відображення сповіщення', e);

            // Запасний варіант - звичайний alert
            alert(message);
            if (typeof callback === 'function') {
                setTimeout(callback, 100);
            }

            return false;
        }
    },

    /**
     * Показує модальне вікно підтвердження в стилі WINIX
     */
    showConfirmation: function(message, onConfirm, onCancel) {
        try {
            // Створюємо затемнений фон
            const overlay = document.createElement('div');
            overlay.className = 'winix-modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9998;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;

            // Створюємо модальне вікно
            const modal = document.createElement('div');
            modal.className = 'winix-modal';
            modal.style.cssText = `
                background: linear-gradient(135deg, #2B3144, #1A1F2F);
                border-radius: 15px;
                padding: 25px;
                width: 85%;
                max-width: 350px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                transform: scale(0.9);
                transition: transform 0.3s ease;
                color: white;
            `;

            // Створюємо повідомлення
            const modalMessage = document.createElement('div');
            modalMessage.textContent = message;
            modalMessage.style.cssText = `
                margin: 0 0 20px 0;
                font-size: 16px;
                text-align: center;
                line-height: 1.4;
                color: #ffffff;
            `;

            // Створюємо кнопки
            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                gap: 15px;
            `;

            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Скасувати';
            cancelButton.style.cssText = `
                flex: 1;
                padding: 14px;
                border: none;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.1);
                color: white;
                font-size: 15px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.3s;
            `;

            const confirmButton = document.createElement('button');
            confirmButton.textContent = 'Підтвердити';
            confirmButton.style.cssText = `
                flex: 1;
                padding: 14px;
                border: none;
                border-radius: 10px;
                background: linear-gradient(135deg, #00BFA5, #00CFBB);
                color: white;
                font-size: 15px;
                font-weight: 500;
                cursor: pointer;
                transition: opacity 0.3s;
            `;

            // Функція для закриття модального вікна
            function closeModal() {
                overlay.style.opacity = '0';
                modal.style.transform = 'scale(0.9)';

                setTimeout(() => {
                    if (overlay.parentNode) {
                        document.body.removeChild(overlay);
                    }
                }, 300);
            }

            // Додаємо обробники подій
            cancelButton.addEventListener('click', () => {
                closeModal();
                if (typeof onCancel === 'function') {
                    onCancel();
                }
            });

            confirmButton.addEventListener('click', () => {
                closeModal();
                if (typeof onConfirm === 'function') {
                    onConfirm();
                }
            });

            // Створюємо та підключаємо елементи
            buttonsContainer.appendChild(cancelButton);
            buttonsContainer.appendChild(confirmButton);

            modal.appendChild(modalMessage);
            modal.appendChild(buttonsContainer);
            overlay.appendChild(modal);

            // Додаємо до DOM і запускаємо анімацію
            document.body.appendChild(overlay);

            setTimeout(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1)';
            }, 10);

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
         * Функція валідації суми стейкінгу
         */
        validateStakingAmount: validateStakingAmount,

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

            // Патч для StakingSystem - використовуємо нову систему стейкінгу
            if (!window.stakingSystem && window.WinixStakingSystem) {
                window.stakingSystem = {
                    hasActiveStaking: window.WinixStakingSystem.hasActiveStaking,
                    getStakingDisplayData: window.WinixStakingSystem.getStakingData,
                    getStakingHistory: window.WinixStakingSystem.syncStakingHistoryFromServer,
                    createStaking: function(amount, period) {
                        return window.WinixStakingSystem.createStaking(amount, period)
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
                        return window.WinixStakingSystem.cancelStaking()
                            .then(result => {
                                if (result.success) {
                                    UIManager.showNotification(result.message);
                                } else {
                                    UIManager.showNotification(result.message, MESSAGE_TYPES.ERROR);
                                }
                                return result;
                            });
                    },
                    updateStakingDisplay: window.WinixStakingSystem.updateStakingDisplay,
                    walletSystem: {
                        getBalance: BalanceManager.getTokens
                    }
                };
            } else if (!window.stakingSystem) {
                // Створюємо пустий об'єкт, якщо нової системи немає
                window.stakingSystem = {
                    hasActiveStaking: function() { return false; },
                    getStakingDisplayData: function() {
                        return {
                            hasActiveStaking: false,
                            stakingAmount: 0,
                            rewardPercent: 0,
                            expectedReward: 0,
                            remainingDays: 0
                        };
                    },
                    getStakingHistory: function() { return []; },
                    createStaking: function() {
                        console.error("Система стейкінгу не ініціалізована");
                        return Promise.reject("Система стейкінгу не ініціалізована");
                    },
                    cancelStaking: function() {
                        console.error("Система стейкінгу не ініціалізована");
                        return Promise.reject("Система стейкінгу не ініціалізована");
                    },
                    updateStakingDisplay: function() { },
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