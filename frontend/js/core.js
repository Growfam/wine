/**
 * core.js - Базова функціональність WINIX
 * Оптимізована версія з покращеною інтеграцією з API та Auth модулями
 * @version 1.4.0
 */

(function() {
    'use strict';

    console.log("🔄 Core: Ініціалізація ядра WINIX");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Дані користувача
    let _userData = null;

    // Інтервал автооновлення
    let _refreshInterval = null;

    // Прапорець для індикатора завантаження
    let _loaderVisible = false;

    // Лічильник останнього запиту
    let _lastRequestTime = 0;

    // Мінімальний інтервал між запитами (збільшено з 5 до 15 секунд)
    const MIN_REQUEST_INTERVAL = 15000;

    // Час життя кешу даних користувача
    const USER_CACHE_TTL = 300000; // 5 хвилин

    // Прапорець, що вказує, чи виконується запит до API
    let _requestInProgress = false;

    // Лічильник помилок - для відстеження критичних проблем
    let _errorCounter = 0;
    const MAX_ERRORS_BEFORE_RESET = 5;
    let _lastErrorTime = 0;

    // Прапорець блокування оновлення балансу для запобігання гонам даних
    let _balanceUpdateLocked = false;
    let _balanceUpdateLockExpires = 0;
    let _lastKnownBalance = {
        tokens: null,
        coins: null,
        timestamp: 0
    };

    // Реєстр транзакцій для відстеження локальних змін
    const _transactionRegistry = {
        pendingTransactions: [],
        lastTransactionId: 0,

        // Метод для запису нової транзакції
        record: function(type, amount, oldBalance, newBalance, details = {}) {
            const transactionId = ++this.lastTransactionId;
            const transaction = {
                id: transactionId,
                type: type,
                amount: amount,
                oldBalance: oldBalance,
                newBalance: newBalance,
                details: details,
                timestamp: Date.now(),
                confirmed: false,
                source: details.source || 'core.js'
            };

            this.pendingTransactions.push(transaction);

            // Зберігаємо в localStorage для відновлення після оновлення сторінки
            this.saveToStorage();

            return transactionId;
        },

        // Метод для підтвердження транзакції
        confirm: function(transactionId, serverBalance = null) {
            const transaction = this.pendingTransactions.find(t => t.id === transactionId);
            if (transaction) {
                transaction.confirmed = true;
                if (serverBalance !== null) {
                    transaction.serverBalance = serverBalance;
                }
                this.saveToStorage();
            }
        },

        // Метод для збереження реєстру в localStorage
        saveToStorage: function() {
            try {
                localStorage.setItem('winix_transaction_registry', JSON.stringify({
                    transactions: this.pendingTransactions,
                    lastId: this.lastTransactionId
                }));
            } catch (e) {
                console.warn("⚠️ Помилка збереження реєстру транзакцій:", e);
            }
        },

        // Метод для завантаження реєстру з localStorage
        loadFromStorage: function() {
            try {
                const data = localStorage.getItem('winix_transaction_registry');
                if (data) {
                    const parsed = JSON.parse(data);
                    this.pendingTransactions = parsed.transactions || [];
                    this.lastTransactionId = parsed.lastId || 0;
                }
            } catch (e) {
                console.warn("⚠️ Помилка завантаження реєстру транзакцій:", e);
            }
        },

        // Отримання останньої транзакції певного типу
        getLastTransaction: function(type = null) {
            if (this.pendingTransactions.length === 0) return null;

            if (type === null) {
                return this.pendingTransactions[this.pendingTransactions.length - 1];
            }

            // Шукаємо останню транзакцію вказаного типу
            for (let i = this.pendingTransactions.length - 1; i >= 0; i--) {
                if (this.pendingTransactions[i].type === type) {
                    return this.pendingTransactions[i];
                }
            }

            return null;
        },

        // Видалення старих транзакцій
        cleanup: function(maxAgeMs = 86400000) { // 24 години за замовчуванням
            const now = Date.now();
            this.pendingTransactions = this.pendingTransactions.filter(tx => {
                return (now - tx.timestamp) < maxAgeMs;
            });
            this.saveToStorage();
        }
    };

    // Завантажуємо реєстр транзакцій з localStorage
    _transactionRegistry.loadFromStorage();

    // Виконуємо очищення старих транзакцій
    _transactionRegistry.cleanup();

    // Перевірка доступності модулів з повною перевіркою
    const hasApiModule = () => {
        try {
            return window.WinixAPI &&
                   typeof window.WinixAPI.apiRequest === 'function' &&
                   typeof window.WinixAPI.getUserId === 'function';
        } catch (e) {
            console.error("🔄 Core: Помилка перевірки API модуля:", e);
            return false;
        }
    };

    const hasAuthModule = () => {
        try {
            return window.WinixAuth &&
                   typeof window.WinixAuth.getUserData === 'function' &&
                   typeof window.WinixAuth.getUserIdFromAllSources === 'function';
        } catch (e) {
            console.error("🔄 Core: Помилка перевірки Auth модуля:", e);
            return false;
        }
    };

    // Перевірка доступності модулю обробки помилок
    const hasErrorHandler = () => {
        try {
            return window.WinixRaffles &&
                   window.WinixRaffles.errorHandler &&
                   typeof window.WinixRaffles.errorHandler.showUserFriendlyError === 'function';
        } catch (e) {
            console.error("🔄 Core: Помилка перевірки ErrorHandler модуля:", e);
            return false;
        }
    };

    // Перевірка доступності сервісу синхронізації
    const hasSyncService = () => {
        try {
            return window.WinixRaffles &&
                   window.WinixRaffles.syncService &&
                   typeof window.WinixRaffles.syncService.syncAll === 'function';
        } catch (e) {
            console.error("🔄 Core: Помилка перевірки SyncService модуля:", e);
            return false;
        }
    };

    // Реєстр обробників для подій WinixCore
    const _eventHandlers = {
        'user-data-updated': [],
        'balance-updated': [],
        'transaction-complete': [],
        'core-initialized': [],
        'error': []
    };

    // ======== УТИЛІТИ ========

    /**
     * Отримання елемента DOM
     * @param {string} selector - Селектор елемента
     * @param {boolean} multiple - Отримати всі елементи
     */
    function getElement(selector, multiple = false) {
        try {
            if (multiple) {
                return document.querySelectorAll(selector);
            }
            if (selector.startsWith('#')) {
                return document.getElementById(selector.substring(1));
            }
            return document.querySelector(selector);
        } catch (e) {
            console.error('Помилка отримання елемента DOM:', e);
            return null;
        }
    }

    /**
     * Зберігання даних в localStorage
     * @param {string} key - Ключ
     * @param {any} value - Значення
     */
    function saveToStorage(key, value) {
        try {
            if (typeof value === 'object') {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }
            return true;
        } catch (e) {
            console.error(`Помилка збереження в localStorage: ${key}`, e);
            return false;
        }
    }

    /**
     * Отримання даних з localStorage
     * @param {string} key - Ключ
     * @param {any} defaultValue - Значення за замовчуванням
     * @param {boolean} isObject - Чи парсити як об'єкт
     */
    function getFromStorage(key, defaultValue = null, isObject = false) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;

            if (isObject) {
                try {
                    return JSON.parse(value);
                } catch (e) {
                    return defaultValue;
                }
            }

            return value;
        } catch (e) {
            return defaultValue;
        }
    }

    /**
     * Форматування числа як валюти
     * @param {number} amount - Сума
     * @param {number} decimals - Кількість знаків після коми
     */
    function formatCurrency(amount, decimals = 2) {
        try {
            const numberFormat = new Intl.NumberFormat('uk-UA', {
                maximumFractionDigits: decimals,
                minimumFractionDigits: decimals
            });
            return numberFormat.format(parseFloat(amount) || 0);
        } catch (e) {
            return (parseFloat(amount) || 0).toFixed(decimals);
        }
    }

    /**
     * Перевірка, чи пристрій онлайн
     * @returns {boolean} Стан підключення
     */
    function isOnline() {
        return typeof navigator.onLine === 'undefined' || navigator.onLine;
    }

    /**
     * Функція безпечного очікування завантаження API та Auth модулів
     * @param {number} maxWaitTime - Максимальний час очікування в мс
     * @returns {Promise<boolean>} Результат очікування
     */
    async function waitForModules(maxWaitTime = 5000) {
        const startTime = Date.now();
        const checkInterval = 200; // 200 мс між перевірками

        // Функція для перевірки доступності обох модулів
        const checkModules = () => hasApiModule() && hasAuthModule();

        // Якщо модулі вже доступні, повертаємо true
        if (checkModules()) {
            console.log("🔄 Core: API та Auth модулі вже доступні");
            return true;
        }

        // Очікуємо завантаження модулів
        return new Promise(resolve => {
            const intervalId = setInterval(() => {
                // Перевіряємо доступність модулів
                if (checkModules()) {
                    clearInterval(intervalId);
                    console.log("🔄 Core: API та Auth модулі успішно завантажені");
                    resolve(true);
                    return;
                }

                // Перевіряємо таймаут
                if (Date.now() - startTime > maxWaitTime) {
                    clearInterval(intervalId);
                    console.warn("⚠️ Core: Час очікування завантаження модулів вичерпано");
                    resolve(false);
                }
            }, checkInterval);
        });
    }

    /**
     * Функція для скидання стану та перезавантаження після критичних помилок
     */
    function resetAndReloadApplication() {
        console.log("🔄 Core: Скидання стану додатку через критичні помилки...");

        try {
            // Очищаємо кеш API
            if (hasApiModule() && typeof window.WinixAPI.clearCache === 'function') {
                window.WinixAPI.clearCache();
            }

            // Очищаємо локальне сховище
            try {
                // Зберігаємо лише критичні дані для автентифікації
                const userId = getFromStorage('telegram_user_id');
                const authToken = getFromStorage('auth_token');

                // Очищаємо кеш
                localStorage.clear();

                // Відновлюємо критичні дані
                if (userId) saveToStorage('telegram_user_id', userId);
                if (authToken) saveToStorage('auth_token', authToken);
            } catch (e) {
                console.warn("⚠️ Core: Помилка очищення localStorage:", e);
            }

            // Очищаємо кеш розіграшів
            if (window.WinixRaffles && window.WinixRaffles.state) {
                window.WinixRaffles.state.activeRaffles = [];
                window.WinixRaffles.state.pastRaffles = [];
                window.WinixRaffles.state.isLoading = false;
            }

            // Викликаємо подію перед перезавантаженням
            triggerEvent('before-reset', {
                reason: 'critical_errors',
                errorCount: _errorCounter
            });

            // Перезавантажуємо сторінку через 1 секунду
            setTimeout(function() {
                window.location.reload();
            }, 1000);
        } catch (e) {
            console.error("❌ Core: Помилка скидання стану:", e);
            // У випадку критичної помилки просто перезавантажуємо
            setTimeout(function() {
                window.location.reload();
            }, 500);
        }
    }

    /**
     * Блокує оновлення балансу на певний час (мс)
     * @param {number} durationMs - Тривалість блокування в мс
     * @param {Object} lastBalance - Останній відомий баланс
     */
    function lockBalanceUpdates(durationMs = 10000, lastBalance = null) {
        _balanceUpdateLocked = true;
        _balanceUpdateLockExpires = Date.now() + durationMs;

        if (lastBalance) {
            _lastKnownBalance = {
                tokens: lastBalance.tokens !== undefined ? lastBalance.tokens : _lastKnownBalance.tokens,
                coins: lastBalance.coins !== undefined ? lastBalance.coins : _lastKnownBalance.coins,
                timestamp: Date.now()
            };
        }

        console.log(`🔒 Core: Баланс заблоковано на ${durationMs/1000}с`);

        // Автоматичне розблокування через вказаний час
        setTimeout(function() {
            unlockBalanceUpdates();
        }, durationMs);

        return true;
    }

    /**
     * Розблоковує оновлення балансу
     */
    function unlockBalanceUpdates() {
        _balanceUpdateLocked = false;
        console.log("🔓 Core: Баланс розблоковано");
        return true;
    }

    /**
     * Перевіряє, чи оновлення балансу заблоковане
     * @returns {boolean} Результат перевірки
     */
    function isBalanceUpdateLocked() {
        if (!_balanceUpdateLocked) return false;

        // Перевіряємо, чи блокування не закінчилося
        if (Date.now() > _balanceUpdateLockExpires) {
            _balanceUpdateLocked = false;
            return false;
        }

        return true;
    }

    /**
     * Реєстрація обробника події
     * @param {string} eventName - Назва події
     * @param {Function} handler - Функція-обробник
     * @param {Object} options - Додаткові параметри
     */
    function registerEventHandler(eventName, handler, options = {}) {
        if (!_eventHandlers[eventName]) {
            _eventHandlers[eventName] = [];
        }

        // Перевіряємо, чи такий обробник вже зареєстрований
        const exists = _eventHandlers[eventName].some(h =>
            h.handler.toString() === handler.toString() &&
            h.source === (options.source || 'unknown')
        );

        if (!exists) {
            _eventHandlers[eventName].push({
                handler,
                source: options.source || 'unknown',
                priority: options.priority || 0,
                once: options.once || false
            });

            // Сортуємо обробники за пріоритетом (вищий пріоритет першим)
            _eventHandlers[eventName].sort((a, b) => b.priority - a.priority);

            console.log(`📌 Core: Зареєстровано обробник для події '${eventName}' від джерела '${options.source || 'unknown'}'`);
        }
    }

    /**
     * Видалення обробника події
     * @param {string} eventName - Назва події
     * @param {Function} handler - Функція-обробник
     * @param {string} source - Джерело обробника
     */
    function unregisterEventHandler(eventName, handler, source = 'unknown') {
        if (!_eventHandlers[eventName]) return;

        _eventHandlers[eventName] = _eventHandlers[eventName].filter(h =>
            h.handler.toString() !== handler.toString() || h.source !== source
        );
    }

    /**
     * Виклик події
     * @param {string} eventName - Назва події
     * @param {Object} detail - Дані події
     * @param {Object} options - Додаткові параметри
     */
    function triggerEvent(eventName, detail = {}, options = {}) {
        // Додаємо інформацію про джерело події
        detail.source = options.source || 'core.js';
        detail.timestamp = options.timestamp || Date.now();

        console.log(`🔔 Core: Виклик події '${eventName}' від джерела '${detail.source}'`);

        // Викликаємо власні обробники
        if (_eventHandlers[eventName]) {
            const handlers = [..._eventHandlers[eventName]];

            for (const handlerObj of handlers) {
                try {
                    handlerObj.handler(detail);

                    // Видаляємо обробник, якщо він одноразовий
                    if (handlerObj.once) {
                        unregisterEventHandler(eventName, handlerObj.handler, handlerObj.source);
                    }
                } catch (e) {
                    console.error(`❌ Core: Помилка виконання обробника події '${eventName}':`, e);
                }
            }
        }

        // Викликаємо стандартну подію DOM
        try {
            document.dispatchEvent(new CustomEvent(eventName, { detail }));
        } catch (e) {
            console.error(`❌ Core: Помилка виклику DOM події '${eventName}':`, e);
        }
    }

    // ======== ФУНКЦІЇ КОРИСТУВАЧА ========

    /**
     * Отримання даних користувача
     * @param {boolean} forceRefresh - Примусово оновити
     */
    async function getUserData(forceRefresh = false) {
        // Перевіряємо, чи пристрій онлайн
        if (!isOnline() && !forceRefresh) {
            console.warn("🔄 Core: Пристрій офлайн, використовуємо кешовані дані");

            // Якщо є збережені дані, повертаємо їх
            if (_userData) {
                return _userData;
            }

            // Створюємо базові дані з localStorage
            const storedData = getFromStorage('userData', null, true);
            if (storedData) {
                _userData = storedData;
                return _userData;
            }

            // Створюємо мінімальні дані користувача з localStorage
            const userId = getUserId();
            _userData = {
                telegram_id: userId || 'unknown',
                balance: parseFloat(getFromStorage('userTokens', '0')),
                coins: parseInt(getFromStorage('userCoins', '0')),
                source: 'localStorage_offline'
            };

            return _userData;
        }

        // Перевіряємо частоту запитів
        const now = Date.now();
        if (!forceRefresh && (now - _lastRequestTime < MIN_REQUEST_INTERVAL)) {
            console.log("🔄 Core: Занадто частий запит даних користувача, використовуємо кеш");
            // Якщо у нас вже є дані і не потрібно оновлювати
            if (_userData) {
                return _userData;
            }
        }

        // Запобігаємо паралельним запитам
        if (_requestInProgress && !forceRefresh) {
            console.log("🔄 Core: Запит даних користувача вже виконується");

            // Якщо у нас вже є дані, повертаємо їх
            if (_userData) {
                return _userData;
            }

            // Завантажуємо з localStorage
            const storedData = getFromStorage('userData', null, true);
            if (storedData) {
                _userData = storedData;
                return _userData;
            }
        }

        _lastRequestTime = now;
        _requestInProgress = true;

        try {
            // Перевіряємо наявність модулів
            if (hasAuthModule()) {
                // Використовуємо WinixAuth, якщо доступний
                const userData = await window.WinixAuth.getUserData(forceRefresh);

                _requestInProgress = false;

                if (userData) {
                    _userData = userData;

                    // Оновлюємо дані в localStorage
                    saveToStorage('userData', _userData);

                    // Генеруємо подію оновлення
                    triggerEvent('user-data-updated', { userData: _userData });

                    return _userData;
                }
            } else if (hasApiModule()) {
                // Використовуємо WinixAPI, якщо доступний
                const response = await window.WinixAPI.getUserData(forceRefresh);

                _requestInProgress = false;

                if (response && response.status === 'success' && response.data) {
                    _userData = response.data;

                    // Оновлюємо дані в localStorage
                    saveToStorage('userData', _userData);

                    // Оновлюємо баланс без події оновлення (щоб уникнути дублювання)
                    if (_userData.balance !== undefined) {
                        saveToStorage('userTokens', _userData.balance.toString());
                        saveToStorage('winix_balance', _userData.balance.toString());
                        _lastKnownBalance.tokens = _userData.balance;
                    }

                    if (_userData.coins !== undefined) {
                        saveToStorage('userCoins', _userData.coins.toString());
                        saveToStorage('winix_coins', _userData.coins.toString());
                        _lastKnownBalance.coins = _userData.coins;
                    }

                    _lastKnownBalance.timestamp = Date.now();

                    // Генеруємо подію оновлення
                    triggerEvent('user-data-updated', { userData: _userData });

                    // Скидаємо лічильник помилок при успішному запиті
                    _errorCounter = 0;

                    return _userData;
                }
            } else {
                _requestInProgress = false;

                // Якщо немає модулів - використовуємо дані з localStorage
                const storedUserData = getFromStorage('userData', null, true);
                if (storedUserData) {
                    _userData = storedUserData;
                    return _userData;
                }

                console.warn('🔄 Core: API та Auth модулі недоступні');

                // Створюємо мінімальні дані користувача
                const userId = getUserId();
                _userData = {
                    telegram_id: userId || 'unknown',
                    balance: parseFloat(getFromStorage('userTokens', '0')),
                    coins: parseInt(getFromStorage('userCoins', '0')),
                    source: 'localStorage_no_modules'
                };

                return _userData;
            }
        } catch (error) {
            console.error('Помилка отримання даних користувача:', error);
            _requestInProgress = false;

            // Збільшуємо лічильник помилок
            _errorCounter++;
            _lastErrorTime = Date.now();

            // Відправляємо подію помилки
            triggerEvent('error', {
                message: 'Помилка отримання даних користувача',
                originalError: error,
                module: 'core.js',
                function: 'getUserData'
            });

            // Перевірка на критичну кількість помилок
            if (_errorCounter >= MAX_ERRORS_BEFORE_RESET) {
                console.warn(`⚠️ Core: Досягнуто критичної кількості помилок (${_errorCounter}), скидання стану...`);

                // Показуємо повідомлення про помилку через централізований обробник або вбудований
                if (hasErrorHandler()) {
                    window.WinixRaffles.errorHandler.showUserFriendlyError(
                        'Виникли проблеми з`єднання. Спроба відновлення...',
                        'warning'
                    );
                } else if (typeof window.showToast === 'function') {
                    window.showToast('Виникли проблеми з`єднання. Спроба відновлення...', 'warning');
                }

                // Скидаємо лічильник помилок
                _errorCounter = 0;

                // Запускаємо скидання стану через 1 секунду
                setTimeout(resetAndReloadApplication, 1000);
            }

            // У випадку помилки використовуємо дані з localStorage
            const storedUserData = getFromStorage('userData', null, true);
            if (storedUserData) {
                _userData = storedUserData;
                return _userData;
            }

            // Створюємо мінімальні дані користувача
            const userId = getUserId();
            _userData = {
                telegram_id: userId || 'unknown',
                balance: parseFloat(getFromStorage('userTokens', '0')),
                coins: parseInt(getFromStorage('userCoins', '0')),
                source: 'localStorage_after_error'
            };

            return _userData;
        }
    }

    /**
     * Отримання ID користувача
     * @returns {string|null} ID користувача або null
     */
    function getUserId() {
        // Використовуємо API або Auth модуль, якщо доступні
        if (hasApiModule()) {
            try {
                return window.WinixAPI.getUserId();
            } catch (e) {
                console.warn("🔄 Core: Помилка отримання ID через API:", e);
            }
        } else if (hasAuthModule() && typeof window.WinixAuth.getUserIdFromAllSources === 'function') {
            try {
                return window.WinixAuth.getUserIdFromAllSources();
            } catch (e) {
                console.warn("🔄 Core: Помилка отримання ID через Auth:", e);
            }
        }

        // Резервний варіант - зі сховища
        try {
            const storedId = getFromStorage('telegram_user_id');
            if (storedId && storedId !== 'undefined' && storedId !== 'null') {
                return storedId;
            }
        } catch (e) {
            console.warn("🔄 Core: Помилка отримання ID зі сховища:", e);
        }

        // З DOM
        try {
            const userIdElement = getElement('#header-user-id');
            if (userIdElement && userIdElement.textContent) {
                const id = userIdElement.textContent.trim();
                if (id && id !== 'undefined' && id !== 'null') {
                    saveToStorage('telegram_user_id', id);
                    return id;
                }
            }
        } catch (e) {
            console.warn("🔄 Core: Помилка отримання ID з DOM:", e);
        }

        // З URL
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            if (urlId) {
                saveToStorage('telegram_user_id', urlId);
                return urlId;
            }
        } catch (e) {
            console.warn("🔄 Core: Помилка отримання ID з URL:", e);
        }

        return null;
    }

    /**
     * Оновлення відображення користувача
     */
    function updateUserDisplay() {
        try {
            // Отримуємо актуальні дані
            const userData = _userData || {};
            const userId = userData.telegram_id || getUserId() || getFromStorage('telegram_user_id', 'Unknown ID');
            const username = userData.username || getFromStorage('username', 'User');

            // Оновлюємо ID користувача
            const userIdElement = getElement('#header-user-id');
            if (userIdElement) {
                userIdElement.textContent = userId;
            }

            // Оновлюємо ім'я користувача
            const usernameElement = getElement('#username');
            if (usernameElement) {
                usernameElement.textContent = username;
            }

            // Оновлюємо аватар
            updateUserAvatar(username);
        } catch (e) {
            console.error('Помилка оновлення відображення користувача:', e);
        }
    }

    /**
     * Оновлення аватара користувача
     * @param {string} username - Ім'я користувача
     */
    function updateUserAvatar(username) {
        try {
            const avatarElement = getElement('#profile-avatar');
            if (!avatarElement) return;

            // Очищаємо вміст аватара
            avatarElement.innerHTML = '';

            // Перевіряємо наявність зображення аватара
            username = username || _userData?.username || getFromStorage('username', 'User');
            const avatarSrc = getFromStorage('userAvatarSrc') || getFromStorage('avatarSrc');

            if (avatarSrc) {
                // Створюємо зображення
                const img = document.createElement('img');
                img.src = avatarSrc;
                img.alt = username;
                img.onerror = () => {
                    // Якщо не вдалося завантажити, показуємо першу літеру імені
                    avatarElement.textContent = username[0].toUpperCase();
                };
                avatarElement.appendChild(img);
            } else {
                // Показуємо першу літеру імені
                avatarElement.textContent = username[0].toUpperCase();
            }
        } catch (e) {
            console.error('Помилка оновлення аватара:', e);
        }
    }

    /**
     * Отримання балансу користувача
     * @param {boolean} useLastKnown - Використовувати останнє відоме значення
     * @returns {number} Баланс WINIX
     */
    function getBalance(useLastKnown = true) {
        try {
            // Спершу використовуємо останнє відоме значення, якщо воно є і актуальне
            if (useLastKnown && _lastKnownBalance.tokens !== null &&
                (Date.now() - _lastKnownBalance.timestamp) < USER_CACHE_TTL) {
                return _lastKnownBalance.tokens;
            }

            // Далі перевіряємо userData
            if (_userData && _userData.balance !== undefined) {
                // Оновлюємо останнє відоме значення
                _lastKnownBalance.tokens = _userData.balance;
                _lastKnownBalance.timestamp = Date.now();
                return _userData.balance;
            }

            // Потім перевіряємо localStorage
            const storedTokens = parseFloat(getFromStorage('userTokens', '0')) ||
                                parseFloat(getFromStorage('winix_balance', '0')) || 0;

            // Оновлюємо останнє відоме значення
            _lastKnownBalance.tokens = storedTokens;
            _lastKnownBalance.timestamp = Date.now();

            return storedTokens;
        } catch (e) {
            console.warn("⚠️ Core: Помилка отримання балансу:", e);
            return 0;
        }
    }

    /**
     * Отримання кількості жетонів
     * @param {boolean} useLastKnown - Використовувати останнє відоме значення
     * @returns {number} Кількість жетонів
     */
    function getCoins(useLastKnown = true) {
        try {
            // Спершу використовуємо останнє відоме значення, якщо воно є і актуальне
            if (useLastKnown && _lastKnownBalance.coins !== null &&
                (Date.now() - _lastKnownBalance.timestamp) < USER_CACHE_TTL) {
                return _lastKnownBalance.coins;
            }

            // Далі перевіряємо userData
            if (_userData && _userData.coins !== undefined) {
                // Оновлюємо останнє відоме значення
                _lastKnownBalance.coins = _userData.coins;
                _lastKnownBalance.timestamp = Date.now();
                return _userData.coins;
            }

            // Потім перевіряємо localStorage
            const storedCoins = parseInt(getFromStorage('userCoins', '0')) ||
                                parseInt(getFromStorage('winix_coins', '0')) || 0;

            // Оновлюємо останнє відоме значення
            _lastKnownBalance.coins = storedCoins;
            _lastKnownBalance.timestamp = Date.now();

            return storedCoins;
        } catch (e) {
            console.warn("⚠️ Core: Помилка отримання жетонів:", e);
            return 0;
        }
    }

    /**
     * Оновлення відображення балансу
     * @param {boolean} animateChanges - Анімувати зміни
     */
    function updateBalanceDisplay(animateChanges = false) {
        try {
            // Отримуємо текучі значення з DOM для визначення змін
            const tokensElement = getElement('#user-tokens');
            const coinsElement = getElement('#user-coins');

            let currentTokens = 0;
            let currentCoins = 0;

            if (tokensElement) {
                currentTokens = parseFloat(tokensElement.textContent.replace(/\s+/g, '')) || 0;
            }

            if (coinsElement) {
                currentCoins = parseInt(coinsElement.textContent.replace(/\s+/g, '')) || 0;
            }

            // Отримуємо актуальні значення
            const balance = getBalance();
            const coins = getCoins();

            // Оновлюємо відображення токенів
            if (tokensElement) {
                tokensElement.textContent = formatCurrency(balance);

                // Анімуємо зміни, якщо потрібно
                if (animateChanges && balance !== currentTokens) {
                    if (balance > currentTokens) {
                        tokensElement.classList.add('increasing');
                        setTimeout(() => {
                            tokensElement.classList.remove('increasing');
                        }, 1000);
                    } else if (balance < currentTokens) {
                        tokensElement.classList.add('decreasing');
                        setTimeout(() => {
                            tokensElement.classList.remove('decreasing');
                        }, 1000);
                    }
                }
            }

            // Оновлюємо відображення жетонів
            if (coinsElement) {
                coinsElement.textContent = coins;

                // Анімуємо зміни, якщо потрібно
                if (animateChanges && coins !== currentCoins) {
                    if (coins > currentCoins) {
                        coinsElement.classList.add('increasing');
                        setTimeout(() => {
                            coinsElement.classList.remove('increasing');
                        }, 1000);
                    } else if (coins < currentCoins) {
                        coinsElement.classList.add('decreasing');
                        setTimeout(() => {
                            coinsElement.classList.remove('decreasing');
                        }, 1000);
                    }
                }
            }
        } catch (e) {
            console.error('Помилка оновлення відображення балансу:', e);
        }
    }

    /**
     * Оновлення балансу з сервера
     * @param {boolean} forceRefresh - Примусове оновлення, ігноруючи кеш
     * @returns {Promise<Object>} Результат оновлення
     */
    async function refreshBalance(forceRefresh = false) {
        try {
            // Перевіряємо чи доступний сервіс синхронізації для делегування
            if (hasSyncService() && !forceRefresh) {
                console.log("🔄 Core: Делегуємо оновлення балансу сервісу синхронізації");

                // Запускаємо синхронізацію балансу
                const syncResult = await window.WinixRaffles.syncService.syncBalance(false);

                if (syncResult) {
                    // Оновлюємо інтерфейс
                    updateBalanceDisplay(true);
                    return {
                        success: true,
                        delegated: true,
                        data: {
                            balance: getBalance(),
                            coins: getCoins()
                        }
                    };
                }
            }

            // Перевіряємо блокування оновлення балансу
            if (isBalanceUpdateLocked() && !forceRefresh) {
                console.log("🔒 Core: Оновлення балансу заблоковано, використовуємо кеш");

                // Оновлюємо відображення з кешованих даних
                updateBalanceDisplay();

                return {
                    success: true,
                    locked: true,
                    data: {
                        balance: getBalance(),
                        coins: getCoins()
                    }
                };
            }

            // Перевіряємо, чи пристрій онлайн
            if (!isOnline()) {
                console.warn("🔄 Core: Пристрій офлайн, використовуємо локальні дані балансу");

                // Оновлюємо відображення з локальних даних
                updateBalanceDisplay();

                return {
                    success: true,
                    offline: true,
                    data: {
                        balance: getBalance(),
                        coins: getCoins()
                    }
                };
            }

            let balanceData;

            // Перевіряємо наявність API модуля
            if (hasApiModule()) {
                // Отримуємо баланс з API
                const response = await window.WinixAPI.getBalance();

                if (response && response.status === 'success' && response.data) {
                    balanceData = response.data;
                } else {
                    throw new Error(response?.message || 'Не вдалося отримати баланс');
                }
            } else {
                // Якщо API недоступний, отримуємо повні дані користувача
                const userData = await getUserData(true);
                balanceData = {
                    balance: userData.balance || 0,
                    coins: userData.coins || 0
                };
            }

            // Перевіряємо наявність останньої транзакції для конфлікту
            const lastTx = _transactionRegistry.getLastTransaction();
            if (lastTx && lastTx.confirmed === false && (Date.now() - lastTx.timestamp) < 120000) {
                console.log(`⚠️ Виявлено неузгодженість з останньою транзакцією:
                    - Серверні дані: ${balanceData.coins} жетонів
                    - Локальні дані: ${lastTx.newBalance} жетонів`);

                // Для особливо нових транзакцій (до 1 хвилини) довіряємо локальним даним
                if ((Date.now() - lastTx.timestamp) < 60000) {
                    console.log("🛡️ Застосовуємо локальний баланс замість серверного");
                    balanceData.coins = lastTx.newBalance;

                    // Позначаємо транзакцію як підтверджену, але зі старим серверним балансом
                    _transactionRegistry.confirm(lastTx.id, balanceData.coins);
                }
            }

            // Оновлюємо дані користувача
            if (!_userData) _userData = {};

            _userData.balance = balanceData.balance !== undefined ? balanceData.balance : _userData.balance || 0;
            _userData.coins = balanceData.coins !== undefined ? balanceData.coins : _userData.coins || 0;

            // Оновлюємо останнє відоме значення
            _lastKnownBalance.tokens = _userData.balance;
            _lastKnownBalance.coins = _userData.coins;
            _lastKnownBalance.timestamp = Date.now();

            // Зберігаємо в localStorage
            saveToStorage('userTokens', _userData.balance);
            saveToStorage('winix_balance', _userData.balance);
            saveToStorage('userCoins', _userData.coins);
            saveToStorage('winix_coins', _userData.coins);
            saveToStorage('winix_balance_update_time', Date.now().toString());

            // Оновлюємо відображення
            updateBalanceDisplay(true);

            // Генеруємо подію оновлення балансу
            triggerEvent('balance-updated', {
                oldBalance: null, // Не знаємо старе значення
                newBalance: _userData.coins,
                tokens: _userData.balance
            });

            // Скидаємо лічильник помилок при успішному запиті
            _errorCounter = 0;

            return {
                success: true,
                data: {
                    balance: _userData.balance,
                    coins: _userData.coins
                }
            };
        } catch (error) {
            console.error('Помилка оновлення балансу:', error);

            // Збільшуємо лічильник помилок
            _errorCounter++;
            _lastErrorTime = Date.now();

            // Відправляємо подію помилки
            triggerEvent('error', {
                message: 'Помилка оновлення балансу',
                originalError: error,
                module: 'core.js',
                function: 'refreshBalance'
            });

            // У випадку помилки використовуємо кешовані дані
            updateBalanceDisplay();

            return {
                success: false,
                message: error.message || 'Не вдалося оновити баланс',
                data: {
                    balance: getBalance(),
                    coins: getCoins()
                }
            };
        }
    }

    /**
     * Оновлення локального балансу (без запиту до API)
     * @param {number} newCoinsValue - Нова кількість жетонів
     * @param {string} source - Джерело оновлення
     * @param {boolean} confirmed - Чи підтверджено оновлення
     * @returns {Object} Результат оновлення
     */
    function updateLocalBalance(newCoinsValue, source = 'unknown', confirmed = false) {
        try {
            if (newCoinsValue === undefined || newCoinsValue === null) {
                throw new Error("Не вказано нове значення балансу");
            }

            // Отримуємо поточний баланс
            const oldCoins = getCoins();

            // Обчислюємо різницю
            const difference = newCoinsValue - oldCoins;

            // Записуємо транзакцію в реєстр
            const transactionId = _transactionRegistry.record(
                difference > 0 ? 'income' : 'expense',
                Math.abs(difference),
                oldCoins,
                newCoinsValue,
                { source: source, confirmed: confirmed }
            );

            // Якщо транзакція підтверджена, відразу позначаємо її такою
            if (confirmed) {
                _transactionRegistry.confirm(transactionId, newCoinsValue);
            }

            // Оновлюємо дані користувача
            if (_userData) {
                _userData.coins = newCoinsValue;
            }

            // Оновлюємо останнє відоме значення
            _lastKnownBalance.coins = newCoinsValue;
            _lastKnownBalance.timestamp = Date.now();

            // Зберігаємо в localStorage
            saveToStorage('userCoins', newCoinsValue.toString());
            saveToStorage('winix_coins', newCoinsValue.toString());
            saveToStorage('winix_balance_update_time', Date.now().toString());

            // Створюємо запис про останню транзакцію
            saveToStorage('winix_last_transaction', JSON.stringify({
                type: difference > 0 ? 'income' : 'expense',
                amount: Math.abs(difference),
                oldBalance: oldCoins,
                newBalance: newCoinsValue,
                timestamp: Date.now(),
                confirmed: confirmed,
                source: source
            }));

            // Оновлюємо відображення
            updateBalanceDisplay(true);

            // Генеруємо подію оновлення балансу
            triggerEvent('balance-updated', {
                oldBalance: oldCoins,
                newBalance: newCoinsValue,
                difference: difference,
                source: source,
                confirmed: confirmed,
                transactionId: transactionId
            });

            return {
                success: true,
                oldBalance: oldCoins,
                newBalance: newCoinsValue,
                difference: difference,
                transactionId: transactionId
            };
        } catch (error) {
            console.error('❌ Помилка оновлення локального балансу:', error);

            triggerEvent('error', {
                message: 'Помилка оновлення локального балансу',
                originalError: error,
                module: 'core.js',
                function: 'updateLocalBalance'
            });

            return {
                success: false,
                message: error.message || 'Не вдалося оновити локальний баланс'
            };
        }
    }

    /**
     * Реєстрація витрати жетонів
     * @param {number} amount - Кількість витрачених жетонів
     * @param {string} purpose - Мета витрати
     * @param {Object} details - Додаткові деталі
     * @returns {Object} Результат операції
     */
    function spendCoins(amount, purpose = 'unknown', details = {}) {
        try {
            // Перевіряємо валідність кількості
            amount = parseInt(amount);
            if (isNaN(amount) || amount <= 0) {
                throw new Error("Невалідна кількість жетонів для витрати");
            }

            // Отримуємо поточний баланс
            const currentCoins = getCoins();

            // Перевіряємо достатність балансу
            if (currentCoins < amount) {
                return {
                    success: false,
                    message: "Недостатньо жетонів",
                    currentBalance: currentCoins,
                    required: amount
                };
            }

            // Обчислюємо новий баланс
            const newCoins = currentCoins - amount;

            // Блокуємо оновлення балансу на 15 секунд
            lockBalanceUpdates(15000, { coins: newCoins });

            // Оновлюємо локальний баланс
            const updateResult = updateLocalBalance(newCoins, `spend_${purpose}`, false);

            // Додаємо деталі витрати
            return {
                ...updateResult,
                amount: amount,
                purpose: purpose,
                details: details
            };
        } catch (error) {
            console.error('❌ Помилка витрати жетонів:', error);

            triggerEvent('error', {
                message: 'Помилка витрати жетонів',
                originalError: error,
                module: 'core.js',
                function: 'spendCoins'
            });

            return {
                success: false,
                message: error.message || 'Не вдалося витратити жетони'
            };
        }
    }

    /**
     * Підтвердження витрати жетонів після отримання відповіді сервера
     * @param {number} transactionId - ID транзакції для підтвердження
     * @param {number|null} serverBalance - Баланс з сервера
     * @returns {Object} Результат операції
     */
    function confirmSpending(transactionId, serverBalance = null) {
        try {
            // Шукаємо транзакцію
            const transaction = _transactionRegistry.pendingTransactions.find(t => t.id === transactionId);
            if (!transaction) {
                throw new Error(`Транзакція з ID ${transactionId} не знайдена`);
            }

            // Перевіряємо, чи вже підтверджена
            if (transaction.confirmed) {
                return {
                    success: true,
                    alreadyConfirmed: true,
                    transaction: transaction
                };
            }

            // Підтверджуємо транзакцію
            _transactionRegistry.confirm(transactionId, serverBalance);

            // Якщо отримано баланс від сервера, оновлюємо його
            if (serverBalance !== null) {
                // Перевіряємо, чи відрізняється від локального
                if (serverBalance !== transaction.newBalance) {
                    console.log(`⚠️ Виявлено розбіжність між локальним і серверним балансом:
                        - Локальний після транзакції: ${transaction.newBalance}
                        - Серверний: ${serverBalance}`);

                    // Оновлюємо локальний баланс до серверного
                    updateLocalBalance(serverBalance, 'server_sync', true);
                }
            }

            // Генеруємо подію завершення транзакції
            triggerEvent('transaction-complete', {
                transactionId: transactionId,
                confirmed: true,
                serverBalance: serverBalance,
                transaction: transaction
            });

            return {
                success: true,
                transaction: transaction,
                serverBalance: serverBalance
            };
        } catch (error) {
            console.error('❌ Помилка підтвердження витрати:', error);

            triggerEvent('error', {
                message: 'Помилка підтвердження витрати',
                originalError: error,
                module: 'core.js',
                function: 'confirmSpending'
            });

            return {
                success: false,
                message: error.message || 'Не вдалося підтвердити витрату'
            };
        }
    }

    // ======== НАВІГАЦІЯ ========

    /**
     * Ініціалізація навігаційних елементів
     */
    function initNavigation() {
        try {
            const navItems = getElement('.nav-item', true);
            if (!navItems || navItems.length === 0) return;

            // Отримуємо поточний шлях
            const currentPath = window.location.pathname;
            const currentPage = currentPath.split('/').pop().split('.')[0];

            navItems.forEach(item => {
                // Отримуємо секцію з атрибуту
                const section = item.getAttribute('data-section');

                // Перевіряємо, чи поточна сторінка відповідає секції
                if ((currentPage === section) ||
                    (currentPage === '' && section === 'home') ||
                    (currentPage === 'index' && section === 'home')) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }

                // Додаємо обробник кліку
                item.addEventListener('click', () => {
                    // Визначаємо URL для переходу
                    let url;
                    if (section === 'home') {
                        url = 'index.html';
                    } else {
                        url = `${section}.html`;
                    }

                    // Переходимо на сторінку
                    window.location.href = url;
                });
            });
        } catch (e) {
            console.error('Помилка ініціалізації навігації:', e);
        }
    }

    // ======== СИНХРОНІЗАЦІЯ ДАНИХ ========

    /**
     * Синхронізація даних користувача з сервером
     */
    async function syncUserData() {
        try {
            // Спочатку перевіряємо чи доступний сервіс синхронізації
            if (hasSyncService()) {
                console.log("🔄 Core: Делегуємо синхронізацію даних сервісу синхронізації");

                // Запускаємо синхронізацію всіх даних
                const syncResult = await window.WinixRaffles.syncService.syncAll(false);

                // Оновлюємо інтерфейс
                updateUserDisplay();
                updateBalanceDisplay();

                return {
                    success: true,
                    delegated: true,
                    data: _userData
                };
            }

            // Перевіряємо, чи пристрій онлайн
            if (!isOnline()) {
                console.warn("🔄 Core: Пристрій офлайн, використовуємо локальні дані");

                // Оновлюємо відображення з локальних даних
                updateUserDisplay();
                updateBalanceDisplay();

                return {
                    success: true,
                    offline: true,
                    data: _userData || {
                        telegram_id: getUserId() || 'unknown',
                        balance: getBalance(),
                        coins: getCoins(),
                        source: 'localStorage_offline'
                    }
                };
            }

            // Отримуємо дані користувача
            const userData = await getUserData(true);

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            // Генеруємо подію оновлення даних користувача
            triggerEvent('user-data-updated', { userData });

            return {
                success: true,
                data: userData
            };
        } catch (error) {
            console.error('Помилка синхронізації даних користувача:', error);

            // Збільшуємо лічильник помилок
            _errorCounter++;
            _lastErrorTime = Date.now();

            // Відправляємо подію помилки
            triggerEvent('error', {
                message: 'Помилка синхронізації даних користувача',
                originalError: error,
                module: 'core.js',
                function: 'syncUserData'
            });

            // У випадку помилки використовуємо кешовані дані
            updateUserDisplay();
            updateBalanceDisplay();

            return {
                success: false,
                message: error.message || 'Не вдалося синхронізувати дані користувача',
                data: _userData
            };
        }
    }

    /**
     * Запуск періодичної синхронізації даних
     * @param {number} interval - Інтервал у мілісекундах
     */
    function startAutoSync(interval = 300000) { // 5 хвилин
        // Перевіряємо чи є сервіс синхронізації
        if (hasSyncService()) {
            console.log("🔄 Core: Делегуємо періодичне оновлення сервісу синхронізації");
            return true;
        }

        // Зупиняємо попередній інтервал
        if (_refreshInterval) {
            clearInterval(_refreshInterval);
            _refreshInterval = null;
        }

        // Перевіряємо, чи вже запущене оновлення в інших модулях
        if (hasAuthModule() && window.WinixAuth._periodicUpdateInterval) {
            console.log("🔄 Core: Періодичне оновлення вже запущено в Auth модулі");
            return;
        }

        // Запускаємо періодичну синхронізацію
        _refreshInterval = setInterval(async () => {
            try {
                // Перевіряємо, чи пристрій онлайн
                if (!isOnline()) {
                    console.warn("🔄 Core: Пристрій офлайн, пропускаємо синхронізацію");
                    return;
                }

                // Перевіряємо мінімальний інтервал
                if (Date.now() - _lastRequestTime >= MIN_REQUEST_INTERVAL && !_requestInProgress) {
                    await syncUserData();
                }
            } catch (e) {
                console.warn('Помилка автоматичної синхронізації:', e);
            }
        }, interval);

        console.log(`🔄 Core: Періодичне оновлення запущено (інтервал: ${interval}ms)`);
    }

    /**
     * Зупинка періодичної синхронізації
     */
    function stopAutoSync() {
        if (_refreshInterval) {
            clearInterval(_refreshInterval);
            _refreshInterval = null;
            console.log("⏹️ Core: Періодичне оновлення зупинено");
        }
    }

    // ======== ІНІЦІАЛІЗАЦІЯ ========

    /**
     * Ініціалізація ядра WINIX
     */
    async function init() {
        try {
            // Ініціалізуємо Telegram WebApp, якщо він доступний
            if (window.Telegram && window.Telegram.WebApp) {
                try {
                    window.Telegram.WebApp.ready();
                    window.Telegram.WebApp.expand();
                } catch (e) {
                    console.warn("Помилка ініціалізації Telegram WebApp:", e);
                }
            }

            // Перевіряємо статус ініціалізації
            const isInitialized = getFromStorage('winix_core_initialized', 'false') === 'true';
            if (!isInitialized) {
                saveToStorage('winix_core_initialized', 'true');
            }

            // Очікуємо завантаження API та Auth модулів
            await waitForModules();

            // Отримуємо дані користувача
            await getUserData();

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            // Ініціалізуємо навігацію
            initNavigation();

            // Запускаємо автоматичну синхронізацію, якщо не запущена в Auth і немає сервісу синхронізації
            if (!hasAuthModule() || !window.WinixAuth._periodicUpdateInterval) {
                if (!hasSyncService()) {
                    startAutoSync();
                }
            }

            console.log("✅ Core: Ядро WINIX успішно ініціалізовано");

            // Викликаємо подію ініціалізації
            triggerEvent('core-initialized', { version: '1.4.0' });

            return true;
        } catch (error) {
            console.error('Помилка ініціалізації ядра WINIX:', error);

            // Відправляємо подію помилки
            triggerEvent('error', {
                message: 'Помилка ініціалізації ядра WINIX',
                originalError: error,
                module: 'core.js',
                function: 'init'
            });

            // У випадку помилки використовуємо кешовані дані
            updateUserDisplay();
            updateBalanceDisplay();

            triggerEvent('winix-initialization-error', { detail: error });

            return false;
        }
    }

    /**
     * Перевірка чи ядро ініціалізовано
     */
    function isInitialized() {
        return getFromStorage('winix_core_initialized', 'false') === 'true';
    }

    // ======== ОБРОБНИКИ ПОДІЙ ========

    // Глобальна обробка помилок для виявлення проблем
    window.addEventListener('error', function(event) {
        console.error('Критична помилка JavaScript:', event.error);

        // Збільшуємо лічильник помилок
        _errorCounter++;
        _lastErrorTime = Date.now();

        // Відправляємо подію помилки
        triggerEvent('error', {
            message: 'Критична помилка JavaScript',
            originalError: event.error,
            stack: event.error ? event.error.stack : null,
            module: 'core.js',
            eventType: 'window.error'
        });

        // При критичному накопиченні помилок скидаємо стан
        if (_errorCounter >= MAX_ERRORS_BEFORE_RESET) {
            console.warn(`⚠️ Core: Досягнуто критичної кількості помилок (${_errorCounter}), скидання стану...`);

            // Скидаємо лічильник
            _errorCounter = 0;

            // Виводимо сповіщення користувачу через централізований обробник або вбудований
            if (hasErrorHandler()) {
                window.WinixRaffles.errorHandler.showUserFriendlyError(
                    'Виникли проблеми з додатком. Сторінка буде перезавантажена.',
                    'error'
                );
            } else if (typeof window.showToast === 'function') {
                window.showToast('Виникли проблеми з додатком. Сторінка буде перезавантажена.', 'error');
            }

            // Відкладене скидання стану для уникнення циклічних перезавантажень
            setTimeout(resetAndReloadApplication, 2000);
        }
    });

    // Обробник події підключення до мережі
    window.addEventListener('online', function() {
        console.log("🔄 Core: З'єднання з мережею відновлено");

        // Генеруємо власну подію
        triggerEvent('network-online', {});

        // Оновлюємо дані після відновлення з'єднання
        setTimeout(() => {
            if (hasSyncService()) {
                // Використовуємо сервіс синхронізації, якщо доступний
                window.WinixRaffles.syncService.syncAll(true)
                    .then(() => {
                        console.log("🔄 Core: Дані успішно синхронізовано після відновлення з'єднання через syncService");
                    })
                    .catch(error => {
                        console.warn("⚠️ Core: Помилка синхронізації через syncService після відновлення з'єднання:", error);
                    });
            } else {
                // Інакше використовуємо власний метод
                syncUserData().then(() => {
                    console.log("🔄 Core: Дані успішно синхронізовано після відновлення з'єднання");
                }).catch(error => {
                    console.warn("⚠️ Core: Помилка синхронізації після відновлення з'єднання:", error);
                });
            }
        }, 1000);
    });

    // Обробник події відключення від мережі
    window.addEventListener('offline', function() {
        console.warn("⚠️ Core: Втрачено з'єднання з мережею");

        // Генеруємо власну подію
        triggerEvent('network-offline', {});

        // Сповіщаємо користувача через централізований обробник помилок, якщо він доступний
        if (hasErrorHandler()) {
            window.WinixRaffles.errorHandler.showUserFriendlyError(
                'Відсутнє підключення до інтернету. Перевірте мережу.',
                'warning'
            );
        }
    });

    // ======== ПУБЛІЧНИЙ API ========

    // Експортуємо публічний API
    window.WinixCore = {
        // Версія модуля
        version: '1.4.0',

        // Утиліти
        getElement,
        saveToStorage,
        getFromStorage,
        formatCurrency,
        isOnline,
        resetAndReloadApplication,

        // Функції користувача
        getUserData,
        getUserId,
        updateUserDisplay,
        getBalance,
        getCoins,
        updateBalanceDisplay,
        refreshBalance,

        // Функції управління балансом
        updateLocalBalance,
        spendCoins,
        confirmSpending,
        lockBalanceUpdates,
        unlockBalanceUpdates,
        isBalanceUpdateLocked,

        // Функції для синхронізації даних
        syncUserData,
        startAutoSync,
        stopAutoSync,

        // Функції для роботи з подіями
        registerEventHandler,
        unregisterEventHandler,
        triggerEvent,

        // Транзакції
        transactionRegistry: _transactionRegistry,

        // Ініціалізація
        init,
        waitForModules,
        isInitialized
    };

    // Додаємо функцію resetAndReloadApplication в глобальний простір імен
    window.resetAndReloadApplication = resetAndReloadApplication;

    // Ініціалізуємо ядро при завантаженні сторінки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Додаємо невелику затримку для дозавантаження інших модулів
        setTimeout(() => {
            init().catch(e => {
                console.error("Помилка ініціалізації ядра:", e);
            });
        }, 100);
    }
})();