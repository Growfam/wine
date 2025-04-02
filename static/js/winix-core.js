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

// ===== ВИПРАВЛЕННЯ ЩОДЕННОГО БОНУСУ =====
// Вставити цей код в тому ж файлі, якщо в ньому є логіка щоденного бонусу

(function() {
    // Функція для правильної ініціалізації щоденного бонусу
    function initDailyBonus() {
        // Перевіряємо, чи існує елемент щоденного бонусу
        const dailyBonus = document.querySelector('.daily-bonus');
        if (!dailyBonus) return;

        // Отримуємо дату першого входу або встановлюємо її
        let firstLoginDate = localStorage.getItem('firstLoginDate');
        if (!firstLoginDate) {
            firstLoginDate = new Date().toISOString();
            localStorage.setItem('firstLoginDate', firstLoginDate);
        }

        // Розраховуємо, який сьогодні день (від 1 до 7)
        const firstDate = new Date(firstLoginDate);
        const currentDate = new Date();

        // Різниця в днях (округлюємо вниз, щоб 0-24 години = день 1)
        let dayDiff = Math.floor((currentDate - firstDate) / (24 * 60 * 60 * 1000)) + 1;

        // Якщо більше 7 днів, почнемо новий цикл
        if (dayDiff > 7) {
            dayDiff = dayDiff % 7;
            if (dayDiff === 0) dayDiff = 7; // Якщо остача 0, то це 7-й день
        }

        // Оновлюємо відображення днів
        const allDays = document.querySelectorAll('.day-circle');

        // Скидаємо всі активні класи
        allDays.forEach(day => {
            day.classList.remove('active');
            day.classList.remove('completed');
        });

        // Встановлюємо правильні класи для днів
        allDays.forEach((day, index) => {
            const dayNumber = index + 1;

            if (dayNumber < dayDiff) {
                day.classList.add('completed');
            } else if (dayNumber === dayDiff) {
                day.classList.add('active');
            }
        });

        // Оновлюємо прогрес-бар
        const progressBar = document.getElementById('weekly-progress');
        if (progressBar) {
            const progressPercent = (dayDiff / 7) * 100;
            progressBar.style.width = `${progressPercent}%`;
        }

        // Оновлюємо текст кнопки з правильною сумою винагороди
        const claimButton = document.getElementById('claim-daily');
        if (claimButton) {
            // Отримуємо активний день і відповідну винагороду
            const activeDay = document.querySelector('.day-circle.active');
            if (activeDay) {
                const dayMarker = activeDay.closest('.day-marker');
                if (dayMarker) {
                    const rewardElement = dayMarker.querySelector('.day-reward');
                    if (rewardElement && rewardElement.textContent) {
                        const rewardAmount = parseInt(rewardElement.textContent, 10) || 30;
                        claimButton.textContent = `Отримати ${rewardAmount} $WINIX`;

                        // Зберігаємо поточну винагороду для використання пізніше
                        localStorage.setItem('currentDailyBonus', rewardAmount.toString());
                    }
                }
            }

            // Перевіряємо, чи вже отримано бонус сьогодні
            const lastClaimDate = localStorage.getItem('lastDailyBonusDate');
            const today = new Date().toDateString();

            if (lastClaimDate === today) {
                claimButton.disabled = true;
                claimButton.textContent = 'Отримано';
            } else {
                claimButton.disabled = false;
            }

            // Видаляємо всі існуючі обробники подій
            const newButton = claimButton.cloneNode(true);
            claimButton.parentNode.replaceChild(newButton, claimButton);

            // Додаємо новий обробник
            newButton.addEventListener('click', function() {
                if (this.disabled) return;

                // Отримуємо поточну винагороду
                const rewardAmount = parseInt(localStorage.getItem('currentDailyBonus') || '30', 10);

                // Нараховуємо винагороду
                const userTokens = parseFloat(localStorage.getItem('userTokens') || '0');
                localStorage.setItem('userTokens', (userTokens + rewardAmount).toString());

                // Оновлюємо відображення балансу
                const userTokensElement = document.getElementById('user-tokens');
                if (userTokensElement) {
                    userTokensElement.textContent = (userTokens + rewardAmount).toFixed(2);
                }

                // Зберігаємо дату отримання бонусу
                localStorage.setItem('lastDailyBonusDate', today);

                // Оновлюємо вигляд кнопки
                this.disabled = true;
                this.textContent = 'Отримано';

                // Показуємо повідомлення
                if (window.showToast) {
                    window.showToast(`Отримано ${rewardAmount} $WINIX!`);
                } else if (window.simpleAlert) {
                    window.simpleAlert(`Отримано ${rewardAmount} $WINIX!`);
                }
            });
        }
    }

    // Функція запуску при завантаженні сторінки
    function initOnLoad() {
        // Перевіряємо, що сторінка earn.html
        if (window.location.pathname.includes('earn.html')) {
            initDailyBonus();
        }
    }

    // Додаємо обробник завантаження сторінки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOnLoad);
    } else {
        initOnLoad();
    }

    // Додаємо функцію до глобального об'єкту для можливості виклику з інших місць
    window.initDailyBonus = initDailyBonus;
})();

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
 * Виконання API-запиту з обробкою помилок
 * @param {string} endpoint URL API-endpoint
 * @param {Object} options Параметри запиту
 * @returns {Promise<Object>} Результат запиту
 */
async function apiRequest(endpoint, options = {}) {
    try {
        const userId = localStorage.getItem('telegram_user_id');

        // Додаємо заголовок з ID користувача, якщо він є
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
 * Синхронізація даних користувача з сервером
 * @returns {Promise<boolean>} Успішність синхронізації
 */
async function syncUserData() {
    try {
        const userId = localStorage.getItem('telegram_user_id');
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

            // Оновлюємо дані стейкінгу, якщо вони доступні
            if (data.data.staking) {
                safeSetItem(STORAGE_KEYS.STAKING_DATA, data.data.staking);
            }

            // Оновлюємо транзакції, якщо вони доступні
            if (Array.isArray(data.data.transactions)) {
                safeSetItem(STORAGE_KEYS.TRANSACTIONS, data.data.transactions);
            }

            log('info', 'Синхронізація даних з сервером успішна');
            safeSetItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());

            // Оновлюємо відображення, якщо доступні відповідні функції
            if (window.WinixCore && window.WinixCore.UI) {
                window.WinixCore.UI.updateBalanceDisplay();
                window.WinixCore.UI.updateStakingDisplay();
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
        // Отримуємо дані з localStorage для швидкої відповіді
        const balance = parseFloat(safeGetItem(STORAGE_KEYS.USER_TOKENS, '0'));

        // Запускаємо асинхронну синхронізацію з сервером, без очікування результату
        this._syncBalanceFromServer();

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
     * Синхронізація балансу з сервером у фоновому режимі
     * @private
     */
    _syncBalanceFromServer: function() {
        const userId = localStorage.getItem('telegram_user_id');
        if (!userId) return;

        apiRequest(`/api/user/${userId}/balance`)
            .then(data => {
                if (data.status === 'success' && data.data && data.data.balance !== undefined) {
                    // Оновлюємо localStorage лише якщо дані отримано успішно
                    safeSetItem(STORAGE_KEYS.USER_TOKENS, data.data.balance.toString());

                    // Оновлюємо відображення балансу
                    if (window.WinixCore && window.WinixCore.UI) {
                        window.WinixCore.UI.updateBalanceDisplay();
                    }
                }
            })
            .catch(error => {
                log('error', 'Помилка синхронізації балансу з сервером', error);
            });
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

            // Зберігаємо новий баланс локально
            safeSetItem(STORAGE_KEYS.USER_TOKENS, amount.toString());

            // Відправляємо дані на сервер
            const userId = localStorage.getItem('telegram_user_id');
            if (userId) {
                apiRequest(`/api/user/${userId}/balance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ balance: amount })
                }).catch(error => {
                    log('error', 'Помилка оновлення балансу на сервері', error);
                });
            }

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

            // Зберігаємо нову кількість жетонів локально
            safeSetItem(STORAGE_KEYS.USER_COINS, amount.toString());

            // Відправляємо дані на сервер
            const userId = localStorage.getItem('telegram_user_id');
            if (userId) {
                apiRequest(`/api/user/${userId}/coins`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coins: amount })
                }).catch(error => {
                    log('error', 'Помилка оновлення жетонів на сервері', error);
                });
            }

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

            // Зберігаємо новий баланс локально
            safeSetItem(STORAGE_KEYS.USER_TOKENS, newBalance.toString());

            // Відправляємо транзакцію на сервер
            const userId = localStorage.getItem('telegram_user_id');
            if (userId) {
                apiRequest(`/api/user/${userId}/transaction`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: TRANSACTION_TYPES.RECEIVE,
                        amount: amount,
                        description: description
                    })
                }).then(data => {
                    if (data.status === 'success' && data.data && data.data.transaction) {
                        // Якщо сервер повернув нову транзакцію, використовуємо її
                        TransactionManager._addTransactionToLocalList(data.data.transaction);
                    } else {
                        // Інакше додаємо транзакцію локально
                        TransactionManager.addTransaction(
                            TRANSACTION_TYPES.RECEIVE,
                            amount,
                            description
                        );
                    }
                }).catch(error => {
                    log('error', 'Помилка відправлення транзакції на сервер', error);

                    // При помилці додаємо транзакцію локально
                    TransactionManager.addTransaction(
                        TRANSACTION_TYPES.RECEIVE,
                        amount,
                        description
                    );
                });
            } else {
                // Додаємо транзакцію локально, якщо немає ID користувача
                TransactionManager.addTransaction(
                    TRANSACTION_TYPES.RECEIVE,
                    amount,
                    description
                );
            }

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

            // Зберігаємо новий баланс локально
            safeSetItem(STORAGE_KEYS.USER_TOKENS, newBalance.toString());

            // Відправляємо транзакцію на сервер
            const userId = localStorage.getItem('telegram_user_id');
            if (userId) {
                apiRequest(`/api/user/${userId}/transaction`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: TRANSACTION_TYPES.SEND,
                        amount: amount,
                        description: description
                    })
                }).then(data => {
                    if (data.status === 'success' && data.data && data.data.transaction) {
                        // Якщо сервер повернув нову транзакцію, використовуємо її
                        TransactionManager._addTransactionToLocalList(data.data.transaction);
                    } else {
                        // Інакше додаємо транзакцію локально
                        TransactionManager.addTransaction(
                            TRANSACTION_TYPES.SEND,
                            amount,
                            description
                        );
                    }
                }).catch(error => {
                    log('error', 'Помилка відправлення транзакції на сервер', error);

                    // При помилці додаємо транзакцію локально
                    TransactionManager.addTransaction(
                        TRANSACTION_TYPES.SEND,
                        amount,
                        description
                    );
                });
            } else {
                // Додаємо транзакцію локально, якщо немає ID користувача
                TransactionManager.addTransaction(
                    TRANSACTION_TYPES.SEND,
                    amount,
                    description
                );
            }

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

            // Зберігаємо нову кількість жетонів локально
            safeSetItem(STORAGE_KEYS.USER_COINS, newCoins.toString());

            // Відправляємо дані на сервер
            const userId = localStorage.getItem('telegram_user_id');
            if (userId) {
                apiRequest(`/api/user/${userId}/coins/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: amount })
                }).catch(error => {
                    log('error', 'Помилка додавання жетонів на сервері', error);
                });
            }

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

            // Зберігаємо нову кількість жетонів локально
            safeSetItem(STORAGE_KEYS.USER_COINS, newCoins.toString());

            // Відправляємо дані на сервер
            const userId = localStorage.getItem('telegram_user_id');
            if (userId) {
                apiRequest(`/api/user/${userId}/coins/subtract`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: amount })
                }).catch(error => {
                    log('error', 'Помилка зняття жетонів на сервері', error);
                });
            }

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
    hasActiveStaking: function () {
        const stakingData = safeGetItem(STORAGE_KEYS.STAKING_DATA, null, true);

        // Додаємо логування для діагностики
        log('info', 'Перевірка наявності стейкінгу', stakingData);

        if (!stakingData) {
            // Спробуємо синхронізувати з сервером
            this.syncStakingFromServer();
            return false;
        }

        // Перевіряємо прапорець hasActiveStaking та додатково перевіряємо суму стейкінгу
        return stakingData.hasActiveStaking === true && stakingData.stakingAmount > 0;
    },

    /**
     * Отримання даних активного стейкінгу
     * @returns {Object|null} Дані стейкінгу або null, якщо стейкінгу немає
     */
    getStakingData: function () {
        const data = safeGetItem(STORAGE_KEYS.STAKING_DATA, null, true);

        // Додаємо логування для діагностики
        log('info', 'Отримання даних стейкінгу', data);

        // Запускаємо асинхронну синхронізацію з сервером
        this.syncStakingFromServer();

        // Якщо дані відсутні або структура неправильна, повертаємо значення за замовчуванням
        if (!data || typeof data !== 'object') {
            return {
                hasActiveStaking: false,
                stakingAmount: 0,
                rewardPercent: 0,
                expectedReward: 0,
                remainingDays: 0
            };
        }

        // Глибока копія об'єкта, щоб уникнути проблем з посиланнями
        const result = JSON.parse(JSON.stringify(data));

        // Перевіряємо, чи структура даних містить усі необхідні поля
        if (result.hasActiveStaking === undefined) {
            result.hasActiveStaking = false;
        }

        if (result.stakingAmount === undefined || isNaN(parseFloat(result.stakingAmount))) {
            result.stakingAmount = 0;
        } else {
            // Переконуємось, що це число
            result.stakingAmount = parseFloat(result.stakingAmount);
        }

        // Перевіряємо статус стейкінгу
        if (result.hasActiveStaking && result.endDate) {
            const endDate = new Date(result.endDate);
            const now = new Date();

            // Якщо стейкінг завершився, автоматично нараховуємо винагороду
            if (now >= endDate) {
                log('info', 'Стейкінг завершено, нараховуємо винагороду');
                this._finalizeStaking(result);
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
            result.remainingDays = Math.max(0, diffDays);

            // Зберігаємо оновлені дані
            safeSetItem(STORAGE_KEYS.STAKING_DATA, result);
        }

        return result;
    },

    /**
     * Синхронізація даних стейкінгу з сервера
     * @returns {Promise<boolean>} Успішність синхронізації
     */
    syncStakingFromServer: async function() {
        try {
            const userId = localStorage.getItem('telegram_user_id');
            if (!userId) {
                return false;
            }

            log('info', 'Синхронізація даних стейкінгу з сервера');

            const response = await fetch(`/api/user/${userId}/staking`, {
                headers: {
                    'X-Telegram-User-Id': userId
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP помилка! Статус: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' && data.data) {
                // Зберігаємо дані стейкінгу в локальному сховищі
                safeSetItem(STORAGE_KEYS.STAKING_DATA, data.data);

                log('info', 'Дані стейкінгу успішно синхронізовано з сервера');
                return true;
            } else {
                log('error', 'Помилка отримання даних стейкінгу з сервера', data);
                return false;
            }
        } catch (e) {
            log('error', 'Помилка синхронізації даних стейкінгу з сервера', e);
            return false;
        }
    },

    /**
     * Синхронізація історії стейкінгу з сервера
     * @returns {Promise<boolean>} Успішність синхронізації
     */
    syncStakingHistoryFromServer: async function() {
        try {
            const userId = localStorage.getItem('telegram_user_id');
            if (!userId) {
                return false;
            }

            log('info', 'Синхронізація історії стейкінгу з сервера');

            const response = await fetch(`/api/user/${userId}/staking/history`, {
                headers: {
                    'X-Telegram-User-Id': userId
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP помилка! Статус: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' && Array.isArray(data.data)) {
                // Зберігаємо історію стейкінгу в локальному сховищі
                safeSetItem(STORAGE_KEYS.STAKING_HISTORY, data.data);

                log('info', `Синхронізовано ${data.data.length} записів історії стейкінгу з сервера`);
                return true;
            } else {
                log('error', 'Помилка отримання історії стейкінгу з сервера', data);
                return false;
            }
        } catch (e) {
            log('error', 'Помилка синхронізації історії стейкінгу з сервера', e);
            return false;
        }
    },

    /**
     * Автоматичне нарахування винагороди при завершенні стейкінгу
     * @param {Object} stakingData Дані стейкінгу
     * @returns {boolean} Успішність операції
     * @private
     */
    _finalizeStaking: function (stakingData) {
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

            // Відправляємо дані про завершення стейкінгу на сервер
            this._sendStakingFinalizationToServer(stakingData.stakingId, historyEntry);

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
     * Відправка даних про завершення стейкінгу на сервер
     * @param {string} stakingId ID стейкінгу
     * @param {Object} historyEntry Запис для історії
     * @private
     */
    _sendStakingFinalizationToServer: function(stakingId, historyEntry) {
        const userId = localStorage.getItem('telegram_user_id');
        if (!userId) {
            log('warn', 'Неможливо відправити дані завершення стейкінгу: ID користувача не знайдено');
            return;
        }

        fetch(`/api/user/${userId}/staking/${stakingId}/finalize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': userId
            },
            body: JSON.stringify(historyEntry)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP помилка! Статус: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                log('info', 'Дані про завершення стейкінгу успішно відправлено на сервер', data);
            } else {
                log('error', 'Помилка відправки даних про завершення стейкінгу', data);
            }
        })
        .catch(error => {
            log('error', 'Помилка відправки даних про завершення стейкінгу', error);
        });
    },

    /**
     * Додавання запису до історії стейкінгу
     * @param {Object} entry Запис для додавання
     * @returns {boolean} Успішність операції
     * @private
     */
    _addToStakingHistory: function (entry) {
        try {
            // Отримуємо поточну історію
            const history = safeGetItem(STORAGE_KEYS.STAKING_HISTORY, [], true);

            // Додаємо новий запис
            history.unshift(entry);

            // Обмежуємо розмір історії (зберігаємо останні 20 записів)
            const trimmedHistory = history.slice(0, 20);

            // Зберігаємо оновлену історію
            safeSetItem(STORAGE_KEYS.STAKING_HISTORY, trimmedHistory);

            // Відправляємо запис історії на сервер
            this._sendHistoryEntryToServer(entry);

            return true;
        } catch (e) {
            log('error', 'Помилка додавання запису до історії стейкінгу', e);
            return false;
        }
    },

    /**
     * Відправка запису історії стейкінгу на сервер
     * @param {Object} entry Запис для відправки
     * @private
     */
    _sendHistoryEntryToServer: function(entry) {
        const userId = localStorage.getItem('telegram_user_id');
        if (!userId) {
            log('warn', 'Неможливо відправити запис історії стейкінгу: ID користувача не знайдено');
            return;
        }

        fetch(`/api/user/${userId}/staking/history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': userId
            },
            body: JSON.stringify(entry)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP помилка! Статус: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                log('info', 'Запис історії стейкінгу успішно відправлено на сервер', data);
            } else {
                log('error', 'Помилка відправки запису історії стейкінгу', data);
            }
        })
        .catch(error => {
            log('error', 'Помилка відправки запису історії стейкінгу', error);
        });
    },

    /**
     * Розрахунок очікуваної винагороди за стейкінг
     * @param {number} amount Сума стейкінгу
     * @param {number} period Період стейкінгу (днів)
     * @returns {number} Очікувана винагорода
     */
    calculateExpectedReward: function (amount, period) {
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
    createStaking: function (amount, period) {
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

            // Відправляємо дані стейкінгу на сервер
            this._sendStakingToServer(stakingData);

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
     * Відправка даних стейкінгу на сервер
     * @param {Object} stakingData Дані стейкінгу
     * @private
     */
    _sendStakingToServer: function(stakingData) {
    const userId = localStorage.getItem('telegram_user_id') || document.getElementById('user-id').textContent;
    if (!userId) {
        log('warn', 'Неможливо відправити дані стейкінгу: ID користувача не знайдено');
        return Promise.resolve(false);
    }

    return fetch(`/api/user/${userId}/staking`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Telegram-User-Id': userId
        },
        body: JSON.stringify(stakingData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP помилка! Статус: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'success') {
            log('info', 'Дані стейкінгу успішно відправлено на сервер', data);

            // Якщо сервер повернув оновлені дані стейкінгу, оновлюємо обидва ключі
            if (data.data && data.data.staking) {
                const stakingStr = JSON.stringify(data.data.staking);
                safeSetItem(STORAGE_KEYS.STAKING_DATA, data.data.staking);
                localStorage.setItem('stakingData', stakingStr);
                return true;
            }
        } else {
            log('error', 'Помилка відправки даних стейкінгу на сервер', data);
            return false;
        }
    })
    .catch(error => {
        log('error', 'Помилка відправки даних стейкінгу на сервер', error);
        return false;
    });
},

    /**
     * Додавання коштів до існуючого стейкінгу
     * @param {number} amount Сума для додавання
     * @returns {Object} Результат операції
     */
    addToStaking: function (amount) {
        try {
            amount = parseFloat(amount);

            // Перевірка коректності параметрів
            if (isNaN(amount) || amount <= 0) {
                log('warn', 'Некоректна сума для додавання до стейкінгу', amount);
                return {
                    success: false,
                    message: 'Некоректна сума для додавання'
                };
            }

            // Отримуємо дані стейкінгу
            const stakingData = this.getStakingData();

            // Додаємо логування для діагностики
            log('info', 'Спроба додавання до стейкінгу', {amount, stakingData});

            // Перевіряємо наявність активного стейкінгу
            if (!stakingData || !stakingData.hasActiveStaking) {
                log('warn', 'Спроба додати до неіснуючого стейкінгу', stakingData);
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
            const storeResult = safeSetItem(STORAGE_KEYS.STAKING_DATA, stakingData);
            log('info', 'Результат збереження оновлених даних стейкінгу:', storeResult);

            // Додаємо транзакцію
            TransactionManager.addTransaction(
                TRANSACTION_TYPES.STAKE,
                amount,
                'Додавання до стейкінгу'
            );

            // Відправляємо оновлені дані на сервер
            this._updateStakingOnServer(stakingData);

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
     * Оновлення даних стейкінгу на сервері
     * @param {Object} stakingData Дані стейкінгу
     * @private
     */
    _updateStakingOnServer: function(stakingData) {
        const userId = localStorage.getItem('telegram_user_id');
        if (!userId) {
            log('warn', 'Неможливо оновити дані стейкінгу: ID користувача не знайдено');
            return;
        }

        fetch(`/api/user/${userId}/staking/${stakingData.stakingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': userId
            },
            body: JSON.stringify(stakingData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP помилка! Статус: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                log('info', 'Дані стейкінгу успішно оновлено на сервері', data);
            } else {
                log('error', 'Помилка оновлення даних стейкінгу на сервері', data);
            }
        })
        .catch(error => {
            log('error', 'Помилка оновлення даних стейкінгу на сервері', error);
        });
    },

    /**
     * Скасування стейкінгу
     * @returns {Object} Результат операції
     */
    cancelStaking: function () {
        if (_isCancellingStaking) {
            log('warn', 'Вже виконується скасування стейкінгу');
            return {
                success: false,
                message: 'Операція вже виконується'
            };
        }

        _isCancellingStaking = true;

        try {
            // Отримуємо дані стейкінгу перед перевіркою
            const stakingData = this.getStakingData();

            // Додаємо логування для діагностики
            log('info', 'Спроба скасування стейкінгу', stakingData);

            // Перевіряємо наявність активного стейкінгу
            if (!stakingData || !stakingData.hasActiveStaking || stakingData.stakingAmount <= 0) {
                log('warn', 'Спроба скасувати неіснуючий стейкінг', stakingData);
                return {
                    success: false,
                    message: 'У вас немає активного стейкінгу'
                };
            }

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

            // Очищаємо дані стейкінгу в ОБОХ ключах для забезпечення узгодженості
            const emptyStakingData = {
                hasActiveStaking: false,
                stakingAmount: 0,
                rewardPercent: 0,
                expectedReward: 0,
                remainingDays: 0
            };

            // Зберігаємо пусті дані в основному ключі
            safeSetItem(STORAGE_KEYS.STAKING_DATA, emptyStakingData);

            // Зберігаємо пусті дані в альтернативному ключі
            localStorage.setItem('stakingData', JSON.stringify(emptyStakingData));

            // Перевірка, що дані дійсно оновились
            const checkData = safeGetItem(STORAGE_KEYS.STAKING_DATA, null, true);
            if (checkData && checkData.hasActiveStaking) {
                log('error', 'Не вдалося оновити дані стейкінгу після скасування');
                return {
                    success: false,
                    message: 'Помилка оновлення даних стейкінгу'
                };
            }

            // Додаємо повернуті кошти на баланс
            BalanceManager.addTokens(
                returnAmount,
                `Стейкінг скасовано (утримано ${(_config.stakingCancelFee * 100).toFixed(0)}% як штраф)`
            );

            // Відправляємо запит на скасування стейкінгу на сервер
            this._cancelStakingOnServer(stakingData.stakingId, historyEntry);

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
     * Відправка запиту на скасування стейкінгу на сервер
     * @param {string} stakingId ID стейкінгу
     * @param {Object} historyEntry Запис історії
     * @private
     */
    _cancelStakingOnServer: function(stakingId, historyEntry) {
        const userId = localStorage.getItem('telegram_user_id');
        if (!userId) {
            log('warn', 'Неможливо скасувати стейкінг на сервері: ID користувача не знайдено');
            return;
        }

        fetch(`/api/user/${userId}/staking/${stakingId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': userId
            },
            body: JSON.stringify(historyEntry)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP помилка! Статус: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                log('info', 'Стейкінг успішно скасовано на сервері', data);
            } else {
                log('error', 'Помилка скасування стейкінгу на сервері', data);
            }
        })
        .catch(error => {
            log('error', 'Помилка скасування стейкінгу на сервері', error);
        });
    },

    /**
     * Отримання історії стейкінгу
     * @param {number} limit Кількість записів для отримання
     * @returns {Array} Історія стейкінгу
     */
    getStakingHistory: function(limit = 0) {
        const history = safeGetItem(STORAGE_KEYS.STAKING_HISTORY, [], true);

        // Запускаємо фонову синхронізацію історії з сервером
        this.syncStakingHistoryFromServer();

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

            // Створюємо нову транзакцію
            const newTransaction = {
                id: generateId(),
                type,
                amount,
                description: description || this._getDefaultDescription(type),
                timestamp: Date.now(),
                status: 'completed'
            };

            // Спочатку локально додаємо транзакцію для швидкого відображення в UI
            this._addTransactionToLocalStorage(newTransaction);

            // Відправляємо транзакцію на сервер у фоні
            this._sendTransactionToServer(newTransaction);

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
     * Додавання транзакції до локального сховища
     * @param {Object} transaction Транзакція для додавання
     * @returns {boolean} Успішність операції
     * @private
     */
    _addTransactionToLocalStorage: function(transaction) {
        try {
            // Отримуємо поточний список транзакцій
            const transactions = this.getTransactions();

            // Додаємо транзакцію на початок списку
            transactions.unshift(transaction);

            // Обмежуємо розмір списку
            const trimmedTransactions = transactions.slice(
                0,
                _config.maxTransactionHistory
            );

            // Зберігаємо список транзакцій
            safeSetItem(STORAGE_KEYS.TRANSACTIONS, trimmedTransactions);

            // Генеруємо подію додавання транзакції
            emitEvent('transactionAdded', transaction);

            return true;
        } catch (e) {
            log('error', 'Помилка додавання транзакції до локального сховища', e);
            return false;
        }
    },

    /**
     * Відправка транзакції на сервер
     * @param {Object} transaction Транзакція для відправки
     * @returns {Promise<boolean>} Успішність операції
     * @private
     */
    _sendTransactionToServer: function(transaction) {
        const userId = localStorage.getItem('telegram_user_id');
        if (!userId) {
            log('warn', 'Неможливо відправити транзакцію: ID користувача не знайдено');
            return Promise.resolve(false);
        }

        return fetch(`/api/user/${userId}/transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': userId
            },
            body: JSON.stringify(transaction)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP помилка! Статус: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                log('info', 'Транзакцію успішно відправлено на сервер', data);

                // Якщо сервер повернув оновлений об'єкт транзакції, оновлюємо локальний
                if (data.data && data.data.transaction) {
                    this._updateLocalTransaction(transaction.id, data.data.transaction);
                }
                return true;
            } else {
                log('error', 'Помилка відправки транзакції на сервер', data);
                return false;
            }
        })
        .catch(error => {
            log('error', 'Помилка відправки транзакції на сервер', error);
            return false;
        });
    },

    /**
     * Оновлення локальної транзакції даними з сервера
     * @param {string} localId ID локальної транзакції
     * @param {Object} serverTransaction Транзакція з сервера
     * @returns {boolean} Успішність операції
     * @private
     */
    _updateLocalTransaction: function(localId, serverTransaction) {
        try {
            const transactions = this.getTransactions();
            const index = transactions.findIndex(tx => tx.id === localId);

            if (index !== -1) {
                // Зберігаємо локальний ID для посилань в UI
                serverTransaction.localId = localId;
                transactions[index] = serverTransaction;
                safeSetItem(STORAGE_KEYS.TRANSACTIONS, transactions);
                return true;
            }
            return false;
        } catch (e) {
            log('error', 'Помилка оновлення локальної транзакції', e);
            return false;
        }
    },

    /**
     * Додавання транзакції до локального списку з сервера
     * @param {Object} transaction Об'єкт транзакції
     * @private
     */
    _addTransactionToLocalList: function(transaction) {
        try {
            // Отримуємо поточний список транзакцій
            const transactions = this.getTransactions();

            // Перевіряємо, чи транзакція вже є в списку
            const exists = transactions.some(tx => tx.id === transaction.id);

            if (!exists) {
                // Додаємо транзакцію на початок списку
                transactions.unshift(transaction);

                // Обмежуємо розмір списку
                const trimmedTransactions = transactions.slice(
                    0,
                    _config.maxTransactionHistory
                );

                // Зберігаємо список транзакцій
                safeSetItem(STORAGE_KEYS.TRANSACTIONS, trimmedTransactions);

                // Генеруємо подію додавання транзакції
                emitEvent('transactionAdded', transaction);

                log('info', 'Додано нову транзакцію з сервера', transaction);
            }

            return true;
        } catch (e) {
            log('error', 'Помилка додавання транзакції з сервера до локального списку', e);
            return false;
        }
    },

    /**
     * Отримання всіх транзакцій
     * @returns {Array} Список транзакцій
     */
    getTransactions: function() {
        // Отримуємо дані з локального сховища
        const transactions = safeGetItem(STORAGE_KEYS.TRANSACTIONS, [], true);

        // Запускаємо фонову синхронізацію з сервером
        this.syncTransactionsFromServer();

        return transactions;
    },

    /**
     * Синхронізація транзакцій з сервера
     * @returns {Promise<boolean>} Успішність синхронізації
     */
    syncTransactionsFromServer: async function() {
        try {
            const userId = localStorage.getItem('telegram_user_id');
            if (!userId) {
                return false;
            }

            log('info', 'Синхронізація транзакцій з сервера');

            const response = await fetch(`/api/user/${userId}/transactions`, {
                headers: {
                    'X-Telegram-User-Id': userId
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP помилка! Статус: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' && Array.isArray(data.data)) {
                // Зберігаємо транзакції в локальному сховищі
                safeSetItem(STORAGE_KEYS.TRANSACTIONS, data.data);

                log('info', `Синхронізовано ${data.data.length} транзакцій з сервера`);
                return true;
            } else {
                log('error', 'Помилка отримання транзакцій з сервера', data);
                return false;
            }
        } catch (e) {
            log('error', 'Помилка синхронізації транзакцій з сервера', e);
            return false;
        }
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
init: async function(config = {}) {
    try {
        log('info', 'Ініціалізація WinixCore');

        // Оновлюємо конфігурацію
        Object.assign(_config, config);

        // Мігруємо старі дані
        migrateOldData();

        // Синхронізуємо ключі локального сховища
        syncStorageKeys();

        // Спроба початкової синхронізації з сервером
        try {
            // Перевіряємо наявність ID користувача
            const userId = localStorage.getItem('telegram_user_id');
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
            const userId = localStorage.getItem('telegram_user_id');
            if (userId) {
                // Синхронізуємо дані з сервера
                syncUserData().then(success => {
                    if (success) {
                        log('info', 'Періодична синхронізація з сервером успішна');
                    }
                }).catch(error => {
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
            const userId = localStorage.getItem('telegram_user_id');
            if (userId) {
                syncUserData().then(success => {
                    if (success) {
                        log('info', 'Синхронізація при поверненні на вкладку успішна');
                    }
                }).catch(error => {
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

            // Виклик syncStorageKeys() для додаткової синхронізації
            syncStorageKeys();

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

    /**
 * Синхронізація ключів локального сховища
 * @returns {boolean} Успішність операції
 */
function syncStorageKeys() {
    try {
        log('info', 'Синхронізація ключів локального сховища');

        // Мапування ключів
        const keyMappings = {
            'winix_balance': 'userTokens',
            'userTokens': 'winix_balance',
            'winix_coins': 'userCoins',
            'userCoins': 'winix_coins',
            'winix_staking': 'stakingData',
            'stakingData': 'winix_staking',
            'winix_transactions': 'transactions',
            'transactions': 'winix_transactions'
        };

        // Синхронізуємо ключі з атомарним підходом
        for (const [sourceKey, targetKey] of Object.entries(keyMappings)) {
            const sourceValue = localStorage.getItem(sourceKey);
            const targetValue = localStorage.getItem(targetKey);

            // Якщо значення відсутні або однакові, продовжуємо
            if (sourceValue === null && targetValue === null) continue;
            if (sourceValue === targetValue) continue;

            // Особлива логіка для даних стейкінгу
            if (sourceKey === 'winix_staking' || sourceKey === 'stakingData') {
                // ... (код з попереднього прикладу)
            } else {
                // Для інших ключів просто копіюємо непорожнє значення
                const valueToUse = sourceValue || targetValue;
                localStorage.setItem(sourceKey, valueToUse);
                localStorage.setItem(targetKey, valueToUse);
            }
        }

        log('info', 'Ключі локального сховища успішно синхронізовано');
        return true;
    } catch (e) {
        log('error', 'Помилка синхронізації ключів локального сховища:', e);
        return false;
    }
}

    // Повертаємо публічний API
    return WinixCore;
})();
