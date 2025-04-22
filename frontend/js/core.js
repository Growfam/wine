/**
 * core.js - Базова функціональність WINIX
 * Оптимізована версія з покращеною інтеграцією з API та Auth модулями
 * @version 1.3.0
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

    // Прапорець ініціалізації ядра
    let _coreInitialized = false;

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
                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                        detail: { userData: _userData },
                        source: 'core.js'
                    }));

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

                    // Зберігаємо також окремі поля для сумісності
                    if (_userData.balance !== undefined) {
                        saveToStorage('userTokens', _userData.balance.toString());
                        saveToStorage('winix_balance', _userData.balance.toString());
                    }

                    if (_userData.coins !== undefined) {
                        saveToStorage('userCoins', _userData.coins.toString());
                        saveToStorage('winix_coins', _userData.coins.toString());
                    }

                    // Генеруємо подію оновлення
                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                        detail: { userData: _userData },
                        source: 'core.js'
                    }));

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

            // Перевірка на критичну кількість помилок
            if (_errorCounter >= MAX_ERRORS_BEFORE_RESET) {
                console.warn(`⚠️ Core: Досягнуто критичної кількості помилок (${_errorCounter}), скидання стану...`);

                if (typeof window.showToast === 'function') {
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
     */
    function getBalance() {
        try {
            return _userData?.balance ||
                  parseFloat(getFromStorage('userTokens', '0')) ||
                  parseFloat(getFromStorage('winix_balance', '0')) || 0;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Отримання кількості жетонів
     */
    function getCoins() {
        try {
            return _userData?.coins ||
                  parseInt(getFromStorage('userCoins', '0')) ||
                  parseInt(getFromStorage('winix_coins', '0')) || 0;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Оновлення відображення балансу
     */
    function updateBalanceDisplay() {
        try {
            // Оновлюємо відображення токенів
            const tokensElement = getElement('#user-tokens');
            if (tokensElement) {
                const balance = getBalance();
                tokensElement.textContent = formatCurrency(balance);
            }

            // Оновлюємо відображення жетонів
            const coinsElement = getElement('#user-coins');
            if (coinsElement) {
                const coins = getCoins();
                coinsElement.textContent = coins;
            }
        } catch (e) {
            console.error('Помилка оновлення відображення балансу:', e);
        }
    }

    /**
 * Оновлення балансу з сервера
 */
async function refreshBalance() {
    try {
        // Перевіряємо, чи пристрій онлайн
        if (!isOnline()) {
            console.warn("🔄 Core: Пристрій офлайн, використовуємо локальні дані балансу");

            // Отримуємо останні відомі дані балансу
            const lastKnownBalance = getBalance();
            const lastKnownCoins = getCoins();
            const lastUpdateTime = parseInt(localStorage.getItem('winix_balance_update_time') || '0');
            const now = Date.now();

            // Перевіряємо актуальність даних
            const dataAge = now - lastUpdateTime;
            let dataStatus = 'fresh'; // 'fresh', 'stale', 'unknown'

            if (lastUpdateTime === 0) {
                dataStatus = 'unknown';
            } else if (dataAge > 30 * 60 * 1000) { // старше 30 хвилин
                dataStatus = 'stale';
            }

            // Оновлюємо відображення з локальних даних
            updateBalanceDisplay();

            return {
                success: true,
                offline: true,
                dataStatus: dataStatus,
                dataAge: dataAge,
                data: {
                    balance: lastKnownBalance,
                    coins: lastKnownCoins,
                    lastUpdate: lastUpdateTime
                }
            };
        }

        let balanceData;

        // Перевіряємо наявність API модуля
        if (hasApiModule()) {
            // Запам'ятовуємо старі значення перед запитом
            const oldBalance = parseInt(localStorage.getItem('userCoins') || '0');
            const oldTokens = parseFloat(localStorage.getItem('userTokens') || '0');
            const oldLastUpdate = parseInt(localStorage.getItem('winix_balance_update_time') || '0');

            // Отримуємо баланс з API
            const response = await window.WinixAPI.getBalance();

            if (response && response.status === 'success' && response.data) {
                balanceData = response.data;
            } else {
                // У випадку помилки API, але не мережі
                // Повертаємо старі дані але зі статусом помилки
                console.warn('⚠️ API повернуло помилку:', response?.message);
                return {
                    success: false,
                    message: response?.message || 'Не вдалося отримати баланс',
                    data: {
                        balance: oldTokens,
                        coins: oldBalance,
                        lastUpdate: oldLastUpdate
                    }
                };
            }
        } else {
            // Якщо API недоступний, отримуємо повні дані користувача
            const userData = await getUserData(true);
            balanceData = {
                balance: userData.balance || 0,
                coins: userData.coins || 0
            };
        }

            // Оновлюємо дані користувача
            if (!_userData) _userData = {};

            _userData.balance = balanceData.balance !== undefined ? balanceData.balance : _userData.balance || 0;
            _userData.coins = balanceData.coins !== undefined ? balanceData.coins : _userData.coins || 0;

            // Зберігаємо в localStorage
            saveToStorage('userTokens', _userData.balance);
            saveToStorage('winix_balance', _userData.balance);
            saveToStorage('userCoins', _userData.coins);
            saveToStorage('winix_coins', _userData.coins);

            // Оновлюємо відображення
            updateBalanceDisplay();

            // Генеруємо подію оновлення балансу
            document.dispatchEvent(new CustomEvent('balance-updated', {
                detail: {
                    balance: _userData.balance,
                    coins: _userData.coins
                },
                source: 'core.js'
            }));

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

    // Беремо кешовані дані з позначенням часу останнього оновлення
    const cachedBalance = getBalance();
    const cachedCoins = getCoins();
    const lastUpdate = parseInt(localStorage.getItem('winix_balance_update_time') || '0');

    // Оновлюємо відображення з кешованих даних
    updateBalanceDisplay();

    return {
        success: false,
        offline: !window.navigator.onLine,
        message: error.message || 'Не вдалося оновити баланс',
        data: {
            balance: cachedBalance,
            coins: cachedCoins,
            lastUpdate: lastUpdate
        }
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
            // Перевіряємо, чи пристрій онлайн
if (!isOnline()) {
    console.warn("🔄 Core: Пристрій офлайн, використовуємо локальні дані балансу");

    // Отримуємо останні відомі дані балансу
    const lastKnownBalance = getBalance();
    const lastKnownCoins = getCoins();
    const lastUpdateTime = parseInt(localStorage.getItem('winix_balance_update_time') || '0');
    const now = Date.now();

    // Перевіряємо актуальність даних
    const dataAge = now - lastUpdateTime;
    let dataStatus = 'fresh'; // 'fresh', 'stale', 'unknown'

    if (lastUpdateTime === 0) {
        dataStatus = 'unknown';
    } else if (dataAge > 30 * 60 * 1000) { // старше 30 хвилин
        dataStatus = 'stale';
    }

    // Оновлюємо відображення з локальних даних
    updateBalanceDisplay();

    // Показуємо користувачу статус, якщо дані застарілі
    if (dataStatus === 'stale' && typeof window.showToast === 'function') {
        window.showToast('Використовуються локально збережені дані. Оновіть баланс при підключенні.', 'info');
    }

    return {
        success: true,
        offline: true,
        dataStatus: dataStatus,
        dataAge: dataAge,
        data: {
            balance: lastKnownBalance,
            coins: lastKnownCoins,
            lastUpdate: lastUpdateTime
        }
    };
}

            // Отримуємо дані користувача
            const userData = await getUserData(true);

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            // Генеруємо подію оновлення даних користувача
            document.dispatchEvent(new CustomEvent('user-data-updated', {
                detail: { userData },
                source: 'core.js'
            }));

            return {
                success: true,
                data: userData
            };
        } catch (error) {
            console.error('Помилка синхронізації даних користувача:', error);

            // Збільшуємо лічильник помилок
            _errorCounter++;
            _lastErrorTime = Date.now();

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
            // Перевіряємо чи вже ініціалізовано ядро
            if (_coreInitialized) {
                console.log("✅ Core: Ядро WINIX вже ініціалізоване");
                return true;
            }

            // Ініціалізуємо Telegram WebApp, якщо він доступний
            if (window.Telegram && window.Telegram.WebApp) {
                try {
                    window.Telegram.WebApp.ready();
                    window.Telegram.WebApp.expand();
                } catch (e) {
                    console.warn("Помилка ініціалізації Telegram WebApp:", e);
                }
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

            // Запускаємо автоматичну синхронізацію, якщо не запущена в Auth
            if (!hasAuthModule() || !window.WinixAuth._periodicUpdateInterval) {
                startAutoSync();
            }

            // Позначаємо, що ядро ініціалізовано
            _coreInitialized = true;

            console.log("✅ Core: Ядро WINIX успішно ініціалізовано");

            // Викликаємо подію ініціалізації
            document.dispatchEvent(new CustomEvent('winix-initialized'));

            return true;
        } catch (error) {
            console.error('Помилка ініціалізації ядра WINIX:', error);

            // У випадку помилки використовуємо кешовані дані
            updateUserDisplay();
            updateBalanceDisplay();

            document.dispatchEvent(new CustomEvent('winix-initialization-error', { detail: error }));

            return false;
        }
    }

    /**
     * Перевірка доступності ядра
     * @returns {boolean} Стан ініціалізації
     */
    function isInitialized() {
        return _coreInitialized;
    }

    // ======== ОБРОБНИКИ ПОДІЙ ========

    // Обробник події оновлення даних користувача
    document.addEventListener('user-data-updated', function(event) {
        if (event.detail && event.detail.userData && event.source !== 'core.js') {
            console.log("🔄 Core: Отримано подію оновлення даних користувача");
            _userData = event.detail.userData;
            updateUserDisplay();
            updateBalanceDisplay();
        }
    });

    // Обробник події оновлення балансу
    document.addEventListener('balance-updated', function(event) {
        if (event.detail && event.source !== 'core.js') {
            console.log("🔄 Core: Отримано подію оновлення балансу");
            if (!_userData) _userData = {};

            if (event.detail.balance !== undefined) {
                _userData.balance = event.detail.balance;
            }

            if (event.detail.coins !== undefined) {
                _userData.coins = event.detail.coins;
            }

            updateBalanceDisplay();
        }
    });

    // Обробник події підключення до мережі
    window.addEventListener('online', function() {
        console.log("🔄 Core: З'єднання з мережею відновлено");

        // Оновлюємо дані після відновлення з'єднання
        setTimeout(() => {
            syncUserData().then(() => {
                console.log("🔄 Core: Дані успішно синхронізовано після відновлення з'єднання");
            }).catch(error => {
                console.warn("⚠️ Core: Помилка синхронізації після відновлення з'єднання:", error);
            });
        }, 1000);
    });

    // Обробник події відключення від мережі
    window.addEventListener('offline', function() {
        console.warn("⚠️ Core: Втрачено з'єднання з мережею");
    });

    // Глобальна обробка помилок для виявлення проблем
    window.addEventListener('error', function(event) {
        console.error('Критична помилка JavaScript:', event.error);

        // Збільшуємо лічильник помилок
        _errorCounter++;
        _lastErrorTime = Date.now();

        // При критичному накопиченні помилок скидаємо стан
        if (_errorCounter >= MAX_ERRORS_BEFORE_RESET) {
            console.warn(`⚠️ Core: Досягнуто критичної кількості помилок (${_errorCounter}), скидання стану...`);

            // Скидаємо лічильник
            _errorCounter = 0;

            // Виводимо сповіщення користувачу
            if (typeof window.showToast === 'function') {
                window.showToast('Виникли проблеми з додатком. Сторінка буде перезавантажена.', 'error');
            }

            // Відкладене скидання стану для уникнення циклічних перезавантажень
            setTimeout(resetAndReloadApplication, 2000);
        }
    });

    // ======== ПУБЛІЧНИЙ API ========

    // Експортуємо публічний API
    window.WinixCore = {
        // Метадані
        version: '1.3.0',
        isInitialized: isInitialized,

        // Утиліти
        getElement,
        saveToStorage,
        getFromStorage,
        formatCurrency,
        isOnline,
        waitForModules,
        resetAndReloadApplication,

        // Функції користувача
        getUserData,
        getUserId,
        updateUserDisplay,
        getBalance,
        getCoins,
        updateBalanceDisplay,
        refreshBalance,

        // Функції для синхронізації даних
        syncUserData,
        startAutoSync,
        stopAutoSync,

        // Ініціалізація
        init
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