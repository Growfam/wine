/**
 * core.js - Базова функціональність WINIX
 * Версія без заглушок - тільки реальні дані з бекенду
 * @version 3.0.0
 */

(function() {
    'use strict';

    console.log("🔄 Core: Ініціалізація ядра WINIX");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Дані користувача
    let _userData = null;

    // Стан модуля
    const _state = {
        initialized: false,
        refreshInterval: null,
        requestInProgress: false,
        lastRequestTime: 0,
        errorCounter: 0,
        maxErrorsBeforeReset: 5,
        apiStats: {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0
        }
    };

    // Конфігурація
    const _config = {
        minRequestInterval: 5000,
        autoRefreshInterval: 300000, // 5 хвилин
        requestTimeout: 15000,
        maxRetries: 3,
        retryInterval: 2000
    };

    // ======== УТИЛІТИ ========

    /**
     * Отримання елемента DOM
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
            console.warn('⚠️ Помилка отримання елемента DOM:', e);
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
            return window.WinixAPI &&
                   typeof window.WinixAPI.apiRequest === 'function';
        } catch (e) {
            console.warn("⚠️ Core: Помилка перевірки API модуля:", e);
            return false;
        }
    }

    /**
     * Отримання Telegram User ID
     */
    function getTelegramUserId() {
        // Використовуємо функцію з auth.js
        if (window.WinixAuth && typeof window.WinixAuth.getTelegramUserId === 'function') {
            return window.WinixAuth.getTelegramUserId();
        }

        // Якщо auth.js ще не завантажений, пробуємо отримати напряму
        try {
            if (window.Telegram &&
                window.Telegram.WebApp &&
                window.Telegram.WebApp.initDataUnsafe &&
                window.Telegram.WebApp.initDataUnsafe.user &&
                window.Telegram.WebApp.initDataUnsafe.user.id) {

                return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
            }
        } catch (e) {
            console.error("⚠️ Core: Помилка отримання Telegram ID:", e);
        }

        return null;
    }

    /**
     * Відображення повідомлення про помилку користувачу
     */
    function showErrorMessage(errorMessage, type = 'error') {
        const message = typeof errorMessage === 'string' ? errorMessage : 'Сталася помилка';

        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }

        if (window.DailyBonus && typeof window.DailyBonus.showNotification === 'function') {
            window.DailyBonus.showNotification(message, type);
            return;
        }

        if (type === 'error') {
            alert(message);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    // ======== API ФУНКЦІЇ ========

    /**
     * Виконання API-запиту з повторними спробами
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
            throw new Error('No Telegram ID');
        }

        const defaultOptions = {
            timeout: _config.requestTimeout,
            retries: _config.maxRetries,
            retryInterval: _config.retryInterval,
            suppressErrors: false
        };

        const requestOptions = { ...defaultOptions, ...options };
        _state.apiStats.totalRequests++;

        let lastError = null;
        let attempt = 0;

        while (attempt < requestOptions.retries) {
            attempt++;

            try {
                if (attempt > 1) {
                    const delay = requestOptions.retryInterval * Math.pow(1.5, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // Перевіряємо наявність API модуля
                if (!hasApiModule()) {
                    throw new Error('API module not available');
                }

                // Виконуємо запит через WinixAPI
                const apiResult = await window.WinixAPI.apiRequest(endpoint, method, data, {
                    timeout: requestOptions.timeout,
                    suppressErrors: requestOptions.suppressErrors
                });

                if (apiResult.error) {
                    throw new Error(apiResult.message || apiResult.error);
                }

                _state.apiStats.successfulRequests++;
                _state.errorCounter = 0;

                return apiResult;
            } catch (error) {
                lastError = error;
                _state.apiStats.failedRequests++;
                console.error(`❌ Core: Помилка при виконанні ${method} ${endpoint} (спроба ${attempt}/${requestOptions.retries}):`, error);
            }
        }

        _state.errorCounter++;

        if (_state.errorCounter >= _state.maxErrorsBeforeReset && !options.preventReset) {
            console.warn(`⚠️ Core: Досягнуто критичної кількості помилок (${_state.errorCounter}), перезавантаження...`);
            showErrorMessage('Виникли проблеми з підключенням. Перезавантаження...', 'warning');

            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }

        if (requestOptions.suppressErrors) {
            return {
                status: 'error',
                message: lastError?.message || 'Невідома помилка',
                error: lastError
            };
        }

        throw lastError;
    }

    // ======== ФУНКЦІЇ КОРИСТУВАЧА ========

    /**
     * Отримання даних користувача
     */
    async function getUserData(forceRefresh = false) {
        try {
            console.log("🔄 Core: Запит даних користувача");

            // Перевіряємо Telegram ID
            const telegramId = getTelegramUserId();
            if (!telegramId) {
                console.error("❌ Core: Немає Telegram ID");
                return {};
            }

            const now = Date.now();
            if (!forceRefresh && (now - _state.lastRequestTime < _config.minRequestInterval)) {
                console.log("⏳ Core: Занадто частий запит даних користувача");
                return _userData || {};
            }

            if (_state.requestInProgress && !forceRefresh) {
                console.log("⏳ Core: Запит даних користувача вже виконується");
                return _userData || {};
            }

            _state.lastRequestTime = now;
            _state.requestInProgress = true;

            const response = await executeApiRequest(`user/${telegramId}`, 'GET', null, {
                suppressErrors: true
            });

            _state.requestInProgress = false;

            if (response && response.status === 'success' && response.data) {
                _userData = response.data;

                // Генеруємо подію оновлення
                document.dispatchEvent(new CustomEvent('user-data-updated', {
                    detail: { userData: _userData },
                    source: 'core.js'
                }));

                return _userData;
            } else {
                console.error("❌ Core: Помилка отримання даних користувача", response);
                return {};
            }
        } catch (error) {
            console.error("❌ Core: Критична помилка в getUserData:", error);
            _state.requestInProgress = false;
            return {};
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
            updateUserAvatar(username);
        } catch (e) {
            console.warn('⚠️ Помилка оновлення відображення користувача:', e);
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

            // Показуємо першу літеру імені
            avatarElement.innerHTML = '';
            avatarElement.textContent = username[0].toUpperCase();
        } catch (e) {
            console.warn('⚠️ Помилка оновлення аватара:', e);
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
            console.warn('⚠️ Помилка оновлення відображення балансу:', e);
        }
    }

    /**
     * Оновлення локального балансу (тільки візуально, без збереження)
     */
    function updateLocalBalance(newBalance, source = 'unknown', animate = true) {
        if (typeof newBalance !== 'number' || isNaN(newBalance) || newBalance < 0) {
            console.warn('⚠️ Спроба встановити некоректний баланс:', newBalance);
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
                    source: source || 'core.js',
                    timestamp: Date.now()
                }
            }));

            return true;
        } catch (e) {
            console.warn('⚠️ Помилка оновлення локального балансу:', e);
            return false;
        }
    }

    /**
     * Оновлення балансу з сервера
     */
    async function refreshBalance(forceRefresh = false) {
        console.log("🔄 Core: Запит оновлення балансу");

        // Перевіряємо Telegram ID
        const telegramId = getTelegramUserId();
        if (!telegramId) {
            console.error("❌ Core: Немає Telegram ID для оновлення балансу");
            return {
                success: false,
                message: 'No Telegram ID'
            };
        }

        // Перевірка на частоту запитів
        if (!forceRefresh && (Date.now() - _state.lastRequestTime < _config.minRequestInterval)) {
            console.log("⏳ Core: Занадто частий запит балансу");
            return {
                success: true,
                cached: true,
                data: {
                    coins: getCoins()
                }
            };
        }

        if (_state.requestInProgress && !forceRefresh) {
            console.log("⏳ Core: Запит балансу вже виконується");
            return {
                success: true,
                inProgress: true,
                data: {
                    coins: getCoins()
                }
            };
        }

        _state.lastRequestTime = Date.now();
        _state.requestInProgress = true;

        const oldBalance = getCoins();

        try {
            const endpoint = `user/${telegramId}/balance?t=${Date.now()}`;
            const response = await executeApiRequest(endpoint, 'GET', null, {
                suppressErrors: true,
                timeout: 10000
            });

            _state.requestInProgress = false;

            if (response && response.status === 'success' && response.data) {
                const newBalance = response.data.coins !== undefined ? response.data.coins : oldBalance;

                // Оновлюємо відображення
                updateLocalBalance(newBalance, 'core.js', true);

                // Оновлюємо дані користувача
                if (_userData) {
                    _userData.coins = newBalance;
                }

                _state.errorCounter = 0;

                return {
                    success: true,
                    data: {
                        coins: newBalance,
                        oldCoins: oldBalance
                    }
                };
            } else {
                throw new Error(response?.message || 'Не вдалося отримати баланс');
            }
        } catch (error) {
            console.error('❌ Core: Помилка оновлення балансу:', error);
            _state.requestInProgress = false;
            _state.errorCounter++;

            if (_state.errorCounter >= _state.maxErrorsBeforeReset) {
                console.warn(`⚠️ Core: Досягнуто критичної кількості помилок, перезавантаження...`);
                showErrorMessage('Виникли проблеми з підключенням. Перезавантаження...', 'warning');

                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }

            return {
                success: false,
                message: error.message || 'Не вдалося оновити баланс'
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
            console.warn('⚠️ Помилка ініціалізації навігації:', e);
        }
    }

    // ======== СИНХРОНІЗАЦІЯ ДАНИХ ========

    /**
     * Синхронізація даних користувача з сервером
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
            document.dispatchEvent(new CustomEvent('user-data-updated', {
                detail: { userData },
                source: 'core.js'
            }));

            return {
                success: true,
                data: userData
            };
        } catch (error) {
            console.error('❌ Core: Помилка синхронізації даних користувача:', error);

            showErrorMessage('Не вдалося синхронізувати дані', 'warning');

            return {
                success: false,
                message: error.message || 'Не вдалося синхронізувати дані користувача',
                error: error
            };
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
                if (Date.now() - _state.lastRequestTime >= _config.minRequestInterval && !_state.requestInProgress) {
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
     * Ініціалізація ядра WINIX
     */
    async function init(options = {}) {
        try {
            if (_state.initialized) {
                console.log("✅ Core: Ядро WINIX вже ініціалізоване");
                return true;
            }

            console.log("🔄 Core: Початок ініціалізації ядра WINIX");

            // Оновлюємо конфігурацію
            Object.assign(_config, options);

            // Перевіряємо Telegram ID
            const telegramId = getTelegramUserId();
            if (!telegramId) {
                console.error("❌ Core: Немає Telegram ID, блокуємо ініціалізацію");
                return false;
            }

            // Ініціалізуємо Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp) {
                try {
                    window.Telegram.WebApp.ready();
                    window.Telegram.WebApp.expand();
                    console.log("✅ Core: Telegram WebApp успішно ініціалізовано");
                } catch (e) {
                    console.warn("⚠️ Core: Помилка ініціалізації Telegram WebApp:", e);
                }
            }

            // Отримуємо дані користувача
            await getUserData();
            console.log("✅ Core: Дані користувача отримано");

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            // Ініціалізуємо навігацію
            initNavigation();

            // Запускаємо автоматичну синхронізацію
            startAutoSync();

            // Позначаємо, що ядро ініціалізовано
            _state.initialized = true;

            console.log("✅ Core: Ядро WINIX успішно ініціалізовано");

            // Викликаємо подію ініціалізації
            document.dispatchEvent(new CustomEvent('winix-initialized'));

            return true;
        } catch (error) {
            console.error('❌ Core: Помилка ініціалізації ядра WINIX:', error);

            document.dispatchEvent(new CustomEvent('winix-initialization-error', { detail: error }));

            return false;
        }
    }

    /**
     * Перевірка, чи ядро ініціалізовано
     */
    function isInitialized() {
        return _state.initialized;
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

            if (event.detail.newBalance !== undefined) {
                _userData.coins = event.detail.newBalance;
            }

            updateBalanceDisplay();
        }
    });

    // Обробник події завантаження сторінки
    window.addEventListener('load', function() {
        if (!_state.initialized) {
            init().catch(e => {
                console.error("❌ Core: Помилка ініціалізації:", e);
            });
        }
    });

    // Обробник події DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function() {
        if (!_state.initialized) {
            init().catch(e => {
                console.error("❌ Core: Помилка ініціалізації:", e);
            });
        }
    });

    // ======== ПУБЛІЧНИЙ API ========

    window.WinixCore = {
        // Метадані
        version: '3.0.0',
        isInitialized: isInitialized,

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

    console.log("✅ Core: Модуль успішно завантажено");
})();