/**
 * core.js - Базова функціональність WINIX
 * ВИПРАВЛЕНА ВЕРСІЯ БЕЗ undefined проблем та fallback плутанини
 * @version 5.0.0
 */

(function() {
    'use strict';

    console.log("🔄 Core: Ініціалізація ВИПРАВЛЕНОГО ядра WINIX");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Дані користувача
    let _userData = null;
    let _lastDataUpdate = 0;

    // Стан модуля
    const _state = {
        initialized: false,
        apiReady: false,
        authReady: false,
        refreshInterval: null,
        requestInProgress: false,
        lastRequestTime: 0,
        errorCounter: 0
    };

    // Конфігурація
    const _config = {
        minRequestInterval: 5000, // 5 секунд
        autoRefreshInterval: 300000, // 5 хвилин
        requestTimeout: 10000 // 10 секунд
    };

    // ======== УТИЛІТИ ========

    /**
     * Отримання елемента DOM з перевіркою
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
            console.warn('⚠️ Core: Помилка отримання елемента DOM:', e);
            return null;
        }
    }

    /**
     * Форматування числа як валюти
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
     * Перевірка наявності API модуля
     */
    function hasApiModule() {
        try {
            const hasModule = window.WinixAPI &&
                   typeof window.WinixAPI.apiRequest === 'function' &&
                   typeof window.WinixAPI.getUserId === 'function';

            if (hasModule) {
                _state.apiReady = true;
            }

            return hasModule;
        } catch (e) {
            console.warn("⚠️ Core: Помилка перевірки API модуля:", e);
            _state.apiReady = false;
            return false;
        }
    }

    /**
     * Перевірка наявності Auth модуля
     */
    function hasAuthModule() {
        try {
            const hasModule = window.WinixAuth &&
                   typeof window.WinixAuth.getUserData === 'function' &&
                   typeof window.WinixAuth.getTelegramUserId === 'function';

            if (hasModule) {
                _state.authReady = true;
            }

            return hasModule;
        } catch (e) {
            console.warn("⚠️ Core: Помилка перевірки Auth модуля:", e);
            _state.authReady = false;
            return false;
        }
    }

    /**
     * Отримання Telegram User ID
     */
    function getTelegramUserId() {
        // Використовуємо функцію з auth.js (пріоритет)
        if (hasAuthModule() && window.WinixAuth.currentUserId) {
            return window.WinixAuth.currentUserId;
        }

        // Fallback до API модуля
        if (hasApiModule() && typeof window.WinixAPI.getUserId === 'function') {
            return window.WinixAPI.getUserId();
        }

        // Останній fallback - пряме звернення до Telegram
        try {
            if (window.Telegram &&
                window.Telegram.WebApp &&
                window.Telegram.WebApp.initDataUnsafe &&
                window.Telegram.WebApp.initDataUnsafe.user &&
                window.Telegram.WebApp.initDataUnsafe.user.id) {

                return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
            }
        } catch (e) {
            console.warn("⚠️ Core: Помилка отримання Telegram ID:", e);
        }

        return null;
    }

    /**
     * Показати повідомлення про помилку
     */
    function showErrorMessage(errorMessage, type = 'error') {
        const message = typeof errorMessage === 'string' ? errorMessage : 'Сталася помилка';

        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }

        console.log(`${type.toUpperCase()}: ${message}`);
    }

    // ======== API ФУНКЦІЇ ========

    /**
     * ВИПРАВЛЕНЕ виконання API-запиту
     */
    async function executeApiRequest(endpoint, method = 'GET', data = null, options = {}) {
        if (!endpoint) {
            console.error("❌ Core: Невалідний endpoint для запиту");
            throw new Error('Невалідний endpoint');
        }

        // Перевіряємо наявність Telegram ID
        const telegramId = getTelegramUserId();
        if (!telegramId) {
            console.error("❌ Core: Немає Telegram ID для запиту");
            throw new Error("Telegram ID не знайдено");
        }

        // Перевіряємо API модуль
        if (!hasApiModule()) {
            console.error("❌ Core: API модуль недоступний");
            throw new Error("API модуль недоступний");
        }

        const defaultOptions = {
            timeout: _config.requestTimeout,
            ...options
        };

        try {
            console.log(`🔄 Core: Виконання запиту ${method} ${endpoint}`);

            // Виконуємо запит через WinixAPI
            const apiResult = await window.WinixAPI.apiRequest(endpoint, method, data, defaultOptions);

            if (!apiResult || apiResult.status === 'error') {
                throw new Error(apiResult?.message || 'API request failed');
            }

            console.log(`✅ Core: Запит ${method} ${endpoint} успішний`);
            return apiResult;

        } catch (error) {
            console.error(`❌ Core: Помилка при виконанні ${method} ${endpoint}:`, error.message);
            throw error;
        }
    }

    // ======== ФУНКЦІЇ КОРИСТУВАЧА ========

    /**
     * ВИПРАВЛЕНЕ отримання даних користувача
     */
    async function getUserData(forceRefresh = false) {
        try {
            console.log("🔄 Core: Запит даних користувача");

            // Перевіряємо Auth модуль
            if (!hasAuthModule()) {
                console.error("❌ Core: Auth модуль недоступний");
                throw new Error("Auth модуль недоступний");
            }

            // Перевіряємо Telegram ID
            const telegramId = getTelegramUserId();
            if (!telegramId) {
                console.error("❌ Core: Немає Telegram ID");
                throw new Error("Telegram ID не знайдено");
            }

            const now = Date.now();
            if (!forceRefresh && (now - _state.lastRequestTime < _config.minRequestInterval)) {
                console.log("⏳ Core: Частий запит даних користувача, використовуємо кеш");
                return _userData || { telegram_id: telegramId, username: `User_${telegramId.slice(-4)}`, balance: 0, coins: 0 };
            }

            if (_state.requestInProgress && !forceRefresh) {
                console.log("⏳ Core: Запит даних користувача вже виконується");
                return _userData || { telegram_id: telegramId, username: `User_${telegramId.slice(-4)}`, balance: 0, coins: 0 };
            }

            _state.lastRequestTime = now;
            _state.requestInProgress = true;

            // Отримуємо дані через Auth модуль
            const userData = await window.WinixAuth.getUserData(forceRefresh);

            _state.requestInProgress = false;

            if (userData) {
                _userData = userData;
                _lastDataUpdate = now;

                // Генеруємо подію оновлення
                document.dispatchEvent(new CustomEvent('user-data-updated', {
                    detail: { userData: _userData }
                }));

                console.log("✅ Core: Дані користувача успішно отримано");
                return _userData;
            } else {
                throw new Error("Не вдалося отримати дані користувача");
            }

        } catch (error) {
            console.error("❌ Core: Помилка в getUserData:", error);
            _state.requestInProgress = false;
            throw error;
        }
    }

    /**
     * Оновлення відображення користувача
     */
    function updateUserDisplay() {
        try {
            const userData = _userData || {};
            const userId = userData.telegram_id || getTelegramUserId() || '';
            const username = userData.username || 'Користувач';

            // Оновлюємо ID користувача
            const userIdElement = getElement('#header-user-id');
            if (userIdElement && userIdElement.textContent !== userId) {
                userIdElement.textContent = userId;
            }

            // Оновлюємо ім'я користувача
            const usernameElement = getElement('#username');
            if (usernameElement && usernameElement.textContent !== username) {
                usernameElement.textContent = username;
            }

            // Оновлюємо аватар
            updateUserAvatar(userData.username || 'User');
        } catch (e) {
            console.warn('⚠️ Core: Помилка оновлення відображення користувача:', e);
        }
    }

    /**
     * Оновлення аватара користувача
     */
    function updateUserAvatar(username) {
        try {
            const avatarElement = getElement('#profile-avatar');
            if (!avatarElement) return;

            username = username || _userData?.username || 'User';
            avatarElement.innerHTML = '';
            avatarElement.textContent = username[0].toUpperCase();
        } catch (e) {
            console.warn('⚠️ Core: Помилка оновлення аватара:', e);
        }
    }

    /**
     * Отримання балансу користувача
     */
    function getBalance() {
        return _userData?.balance || 0;
    }

    /**
     * Отримання кількості жетонів
     */
    function getCoins() {
        return _userData?.coins || 0;
    }

    /**
     * Оновлення відображення балансу
     */
    function updateBalanceDisplay(animate = false) {
        try {
            // Оновлюємо відображення токенів
            const tokensElement = getElement('#user-tokens');
            if (tokensElement) {
                const balance = getBalance();
                const formattedBalance = formatCurrency(balance);
                tokensElement.textContent = formattedBalance;
            }

            // Оновлюємо відображення жетонів
            const coinsElement = getElement('#user-coins');
            if (coinsElement) {
                const coins = getCoins();
                coinsElement.textContent = coins;

                // Анімація при зміні
                if (animate) {
                    coinsElement.classList.add('updated');
                    setTimeout(() => {
                        coinsElement.classList.remove('updated');
                    }, 1000);
                }
            }
        } catch (e) {
            console.warn('⚠️ Core: Помилка оновлення відображення балансу:', e);
        }
    }

    /**
     * Оновлення локального балансу
     */
    function updateLocalBalance(newBalance, source = 'unknown', animate = true) {
        if (typeof newBalance !== 'number' || isNaN(newBalance) || newBalance < 0) {
            console.warn('⚠️ Core: Спроба встановити некоректний баланс:', newBalance);
            return false;
        }

        try {
            const coinsElement = getElement('#user-coins');
            if (!coinsElement) return false;

            const oldBalance = parseInt(coinsElement.textContent) || 0;
            if (oldBalance === newBalance) return true;

            // Встановлюємо нове значення
            coinsElement.textContent = newBalance;

            // Оновлюємо дані користувача локально
            if (_userData) {
                _userData.coins = newBalance;
            }

            // Анімація
            if (animate) {
                coinsElement.classList.remove('increasing', 'decreasing', 'updated');

                if (newBalance > oldBalance) {
                    coinsElement.classList.add('increasing');
                } else if (newBalance < oldBalance) {
                    coinsElement.classList.add('decreasing');
                }

                setTimeout(() => {
                    coinsElement.classList.remove('increasing', 'decreasing');
                }, 1000);
            }

            // Генеруємо подію про оновлення балансу
            document.dispatchEvent(new CustomEvent('balance-updated', {
                detail: {
                    oldBalance: oldBalance,
                    newBalance: newBalance,
                    source: source,
                    timestamp: Date.now()
                }
            }));

            return true;
        } catch (e) {
            console.warn('⚠️ Core: Помилка оновлення локального балансу:', e);
            return false;
        }
    }

    /**
     * ВИПРАВЛЕНЕ оновлення балансу з сервера
     */
    async function refreshBalance(forceRefresh = false) {
        console.log("🔄 Core: Запит оновлення балансу");

        // Перевіряємо Telegram ID
        const telegramId = getTelegramUserId();
        if (!telegramId) {
            console.error("❌ Core: Немає Telegram ID для оновлення балансу");
            throw new Error("Telegram ID не знайдено");
        }

        // Перевірка на частоту запитів
        if (!forceRefresh && (Date.now() - _state.lastRequestTime < _config.minRequestInterval)) {
            console.log("⏳ Core: Частий запит балансу");
            return {
                success: true,
                cached: true,
                data: { coins: getCoins() }
            };
        }

        if (_state.requestInProgress && !forceRefresh) {
            console.log("⏳ Core: Запит балансу вже виконується");
            return {
                success: true,
                inProgress: true,
                data: { coins: getCoins() }
            };
        }

        _state.lastRequestTime = Date.now();
        _state.requestInProgress = true;

        const oldBalance = getCoins();

        try {
            // Використовуємо API модуль для отримання балансу
            const response = await window.WinixAPI.getBalance();

            _state.requestInProgress = false;

            if (response && response.status === 'success' && response.data) {
                const newBalance = response.data.coins !== undefined ? response.data.coins : oldBalance;

                // Оновлюємо відображення
                updateLocalBalance(newBalance, 'core.js', true);

                // Оновлюємо дані користувача
                if (_userData) {
                    _userData.coins = newBalance;
                }

                return {
                    success: true,
                    data: {
                        coins: newBalance,
                        oldCoins: oldBalance
                    }
                };
            } else {
                throw new Error("Не вдалося отримати баланс");
            }
        } catch (error) {
            console.error('❌ Core: Помилка оновлення балансу:', error);
            _state.requestInProgress = false;
            throw error;
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

            const currentPath = window.location.pathname;
            const currentPage = currentPath.split('/').pop().split('.')[0];

            navItems.forEach(item => {
                const section = item.getAttribute('data-section');

                if ((currentPage === section) ||
                    (currentPage === '' && section === 'home') ||
                    (currentPage === 'index' && section === 'home')) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }

                if (!item.hasAttribute('data-initialized')) {
                    item.setAttribute('data-initialized', 'true');

                    item.addEventListener('click', () => {
                        let url;
                        if (section === 'home') {
                            url = 'index.html';
                        } else {
                            url = `${section}.html`;
                        }

                        window.location.href = url;
                    });
                }
            });
        } catch (e) {
            console.warn('⚠️ Core: Помилка ініціалізації навігації:', e);
        }
    }

    // ======== СИНХРОНІЗАЦІЯ ДАНИХ ========

    /**
     * ВИПРАВЛЕНА синхронізація даних користувача з сервером
     */
    async function syncUserData(forceRefresh = false) {
        try {
            console.log('🔄 Core: Початок синхронізації даних користувача...');

            // Оновлюємо дані користувача
            const userData = await getUserData(forceRefresh);

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            // Генеруємо подію оновлення даних користувача
            if (userData) {
                document.dispatchEvent(new CustomEvent('user-data-updated', {
                    detail: { userData }
                }));
            }

            console.log('✅ Core: Синхронізація даних користувача завершена');

            return {
                success: true,
                data: userData
            };
        } catch (error) {
            console.error('❌ Core: Помилка синхронізації даних користувача:', error);
            throw error;
        }
    }

    /**
     * Запуск періодичної синхронізації даних
     */
    function startAutoSync(interval = 300000) { // 5 хвилин
        if (_state.refreshInterval) {
            clearInterval(_state.refreshInterval);
            _state.refreshInterval = null;
        }

        _state.refreshInterval = setInterval(async () => {
            try {
                // Синхронізуємо тільки якщо немає активних запитів
                if (Date.now() - _state.lastRequestTime >= _config.minRequestInterval &&
                    !_state.requestInProgress) {
                    await syncUserData();
                }
            } catch (e) {
                console.warn('⚠️ Core: Помилка автоматичної синхронізації:', e);
            }
        }, interval);

        console.log(`🔄 Core: Періодичне оновлення запущено (інтервал: ${interval}ms)`);
    }

    /**
     * Зупинка періодичної синхронізації
     */
    function stopAutoSync() {
        if (_state.refreshInterval) {
            clearInterval(_state.refreshInterval);
            _state.refreshInterval = null;
            console.log("⏹️ Core: Періодичне оновлення зупинено");
        }
    }

    // ======== ІНІЦІАЛІЗАЦІЯ ========

    /**
     * ВИПРАВЛЕНА ініціалізація ядра WINIX
     */
    async function init(options = {}) {
        try {
            if (_state.initialized) {
                console.log("✅ Core: Ядро WINIX вже ініціалізоване");
                return true;
            }

            console.log("🔄 Core: Початок ВИПРАВЛЕНОЇ ініціалізації ядра WINIX");

            // Оновлюємо конфігурацію
            Object.assign(_config, options);

            // Чекаємо готовності Auth модуля
            let authWaitAttempts = 0;
            const maxAuthWaitAttempts = 20; // 10 секунд

            while (!hasAuthModule() && authWaitAttempts < maxAuthWaitAttempts) {
                console.log(`⏳ Core: Чекаємо завантаження Auth модуля... (${authWaitAttempts + 1}/${maxAuthWaitAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 500));
                authWaitAttempts++;
            }

            if (!hasAuthModule()) {
                throw new Error("Auth модуль не завантажився");
            }

            console.log("✅ Core: Auth модуль готовий");

            // Чекаємо готовності API модуля
            let apiWaitAttempts = 0;
            const maxApiWaitAttempts = 20; // 10 секунд

            while (!hasApiModule() && apiWaitAttempts < maxApiWaitAttempts) {
                console.log(`⏳ Core: Чекаємо завантаження API модуля... (${apiWaitAttempts + 1}/${maxApiWaitAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 500));
                apiWaitAttempts++;
            }

            if (!hasApiModule()) {
                throw new Error("API модуль не завантажився");
            }

            console.log("✅ Core: API модуль готовий");

            // Перевіряємо Telegram ID
            const telegramId = getTelegramUserId();
            if (!telegramId) {
                throw new Error("Немає Telegram ID");
            }

            console.log(`✅ Core: Telegram ID: ${telegramId}`);

            // Отримуємо дані користувача
            try {
                await getUserData();
                console.log("✅ Core: Дані користувача отримано");
            } catch (error) {
                console.warn("⚠️ Core: Не вдалося отримати дані користувача:", error);
                // Продовжуємо ініціалізацію
            }

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            // Ініціалізуємо навігацію
            initNavigation();

            // Запускаємо автоматичну синхронізацію
            startAutoSync();

            // Позначаємо, що ядро ініціалізовано
            _state.initialized = true;

            console.log("✅ Core: ВИПРАВЛЕНЕ ядро WINIX успішно ініціалізовано");

            // Викликаємо подію ініціалізації
            document.dispatchEvent(new CustomEvent('winix-initialized'));

            return true;
        } catch (error) {
            console.error('❌ Core: Помилка ініціалізації ядра WINIX:', error);
            throw error;
        }
    }

    /**
     * Перевірка, чи ядро ініціалізовано
     */
    function isInitialized() {
        return _state.initialized;
    }

    /**
     * Отримати стан системи
     */
    function getSystemStatus() {
        return {
            initialized: _state.initialized,
            apiReady: _state.apiReady,
            authReady: _state.authReady,
            errorCounter: _state.errorCounter,
            lastDataUpdate: _lastDataUpdate
        };
    }

    // ======== ОБРОБНИКИ ПОДІЙ ========

    // Обробник події оновлення даних користувача
    document.addEventListener('user-data-updated', function(event) {
        if (event.detail && event.detail.userData) {
            console.log("🔄 Core: Отримано подію оновлення даних користувача");
            _userData = event.detail.userData;
            _lastDataUpdate = Date.now();
            updateUserDisplay();
            updateBalanceDisplay();
        }
    });

    // Обробник події оновлення балансу
    document.addEventListener('balance-updated', function(event) {
        if (event.detail && event.detail.newBalance !== undefined) {
            console.log("🔄 Core: Отримано подію оновлення балансу");

            if (!_userData) _userData = {};
            _userData.coins = event.detail.newBalance;

            updateBalanceDisplay();
        }
    });

    // Обробник події готовності Auth
    document.addEventListener('winix-auth-ready', function() {
        console.log("🔄 Core: Auth модуль готовий, запускаємо ініціалізацію");
        if (!_state.initialized) {
            init().catch(e => {
                console.error("❌ Core: Помилка ініціалізації після Auth ready:", e);
            });
        }
    });

    // ======== ПУБЛІЧНИЙ API ========

    window.WinixCore = {
        // Метадані
        version: '5.0.0',
        isInitialized: isInitialized,
        getSystemStatus: getSystemStatus,

        // Утиліти
        getElement,
        formatCurrency,
        executeApiRequest,
        showErrorMessage,

        // Функції користувача
        getUserData,
        getTelegramUserId,
        updateUserDisplay,
        getBalance,
        getCoins,
        updateBalanceDisplay,
        updateLocalBalance,
        refreshBalance,

        // Функції для синхронізації даних
        syncUserData,
        startAutoSync,
        stopAutoSync,

        // Ініціалізація
        init,

        // Конфігурація
        config: _config,

        // Стан модуля (тільки для читання)
        getState: () => ({ ..._state })
    };

    console.log("✅ Core: ВИПРАВЛЕНИЙ модуль успішно завантажено");
})();