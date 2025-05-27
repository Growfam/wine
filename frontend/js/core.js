/**
 * core.js - Базова функціональність WINIX (Fixed Version)
 * Виправлена версія з перевіркою готовності API та кращою обробкою помилок
 * @version 3.1.0
 */

(function() {
    'use strict';

    console.log("🔄 Core: Ініціалізація ядра WINIX (Fixed Version)");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Дані користувача
    let _userData = null;

    // Стан модуля
    const _state = {
        initialized: false,
        apiReady: false,
        serverHealthy: false,
        refreshInterval: null,
        requestInProgress: false,
        lastRequestTime: 0,
        errorCounter: 0,
        maxErrorsBeforeReset: 3, // Зменшено для швидшої реакції
        apiStats: {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            lastHealthCheck: 0
        },
        healthCheckInterval: null
    };

    // Конфігурація
    const _config = {
        minRequestInterval: 3000, // Зменшено для швидшої перевірки
        autoRefreshInterval: 180000, // 3 хвилини
        requestTimeout: 10000,
        maxRetries: 2, // Зменшено кількість спроб
        retryInterval: 1500,
        healthCheckInterval: 30000, // Перевірка здоров'я кожні 30 секунд
        healthCheckTimeout: 5000
    };

    // ======== API HEALTH CHECK ========

    /**
     * Перевірка здоров'я API сервера
     */
    async function checkApiHealth() {
        console.log('🏥 Core: Перевірка здоров\'я API сервера');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), _config.healthCheckTimeout);

            // Простий запит до базового API
            const response = await fetch('/api/health', {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            const isHealthy = response.ok;
            _state.serverHealthy = isHealthy;
            _state.apiStats.lastHealthCheck = Date.now();

            if (isHealthy) {
                console.log('✅ Core: API сервер доступний');
                _state.errorCounter = Math.max(0, _state.errorCounter - 1); // Зменшуємо лічильник помилок
            } else {
                console.warn(`⚠️ Core: API сервер повернув статус ${response.status}`);
                _state.errorCounter++;
            }

            return isHealthy;

        } catch (error) {
            console.error('❌ Core: API сервер недоступний:', error.message);
            _state.serverHealthy = false;
            _state.errorCounter++;

            // Показуємо користувачу стан сервера
            updateServerStatusUI(false);

            return false;
        }
    }

    /**
     * Запуск періодичної перевірки здоров'я
     */
    function startHealthCheck() {
        console.log('🏥 Core: Запуск періодичної перевірки здоров\'я API');

        // Перша перевірка одразу
        checkApiHealth();

        // Періодичні перевірки
        _state.healthCheckInterval = setInterval(() => {
            checkApiHealth();
        }, _config.healthCheckInterval);

        console.log(`✅ Core: Health check запущено (кожні ${_config.healthCheckInterval/1000} сек)`);
    }

    /**
     * Оновлення UI статусу сервера
     */
    function updateServerStatusUI(isHealthy) {
        const statusElement = document.querySelector('.server-status');

        if (!statusElement) {
            // Створюємо елемент статусу якщо його немає
            createServerStatusElement(isHealthy);
            return;
        }

        if (isHealthy) {
            statusElement.style.display = 'none';
        } else {
            statusElement.style.display = 'block';
            statusElement.innerHTML = `
                <div class="server-offline-notice">
                    <h3>⚠️ Сервер тимчасово недоступний</h3>
                    <p>Перевіряємо підключення... Будь ласка, зачекайте.</p>
                    <div class="retry-countdown" id="retry-countdown"></div>
                </div>
            `;
        }
    }

    /**
     * Створення елемента статусу сервера
     */
    function createServerStatusElement(isHealthy) {
        if (isHealthy) return;

        const statusDiv = document.createElement('div');
        statusDiv.className = 'server-status';
        statusDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            padding: 15px;
            text-align: center;
            z-index: 9999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;

        statusDiv.innerHTML = `
            <div class="server-offline-notice">
                <h3 style="margin: 0 0 10px 0;">⚠️ Сервер тимчасово недоступний</h3>
                <p style="margin: 0;">Перевіряємо підключення... Будь ласка, зачекайте.</p>
            </div>
        `;

        document.body.insertBefore(statusDiv, document.body.firstChild);
    }

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
                   typeof window.WinixAPI.apiRequest === 'function';

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

        console.log(`${type.toUpperCase()}: ${message}`);
    }

    // ======== API ФУНКЦІЇ ========

    /**
     * Виконання API-запиту з повторними спробами та перевіркою здоров'я
     */
    async function executeApiRequest(endpoint, method = 'GET', data = null, options = {}) {
        if (!endpoint) {
            console.error("❌ Core: Невалідний endpoint для запиту");
            throw new Error('Невалідний endpoint');
        }

        // Перевіряємо здоров'я сервера перед запитом
        if (!_state.serverHealthy) {
            console.warn("⚠️ Core: Сервер недоступний, перевіряємо статус...");

            const isHealthy = await checkApiHealth();
            if (!isHealthy) {
                throw new Error('Сервер тимчасово недоступний. Спробуйте пізніше.');
            }
        }

        // Перевіряємо наявність Telegram ID
        const telegramId = getTelegramUserId();
        if (!telegramId) {
            console.error("❌ Core: Немає Telegram ID для запиту");
            throw new Error('No Telegram ID');
        }

        // Перевіряємо API модуль
        if (!hasApiModule()) {
            console.error("❌ Core: API модуль недоступний");
            throw new Error('API module not available');
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
                    console.log(`⏳ Core: Затримка ${delay}мс перед спробою ${attempt}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
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
                _state.errorCounter = Math.max(0, _state.errorCounter - 1);

                return apiResult;

            } catch (error) {
                lastError = error;
                _state.apiStats.failedRequests++;
                console.error(`❌ Core: Помилка при виконанні ${method} ${endpoint} (спроба ${attempt}/${requestOptions.retries}):`, error);

                // Перевіряємо тип помилки
                if (error.message.includes('500') || error.message.includes('сервер')) {
                    // Серверна помилка - перевіряємо здоров'я
                    _state.serverHealthy = false;
                    await checkApiHealth();
                }
            }
        }

        _state.errorCounter++;

        // Перевіряємо критичну кількість помилок
        if (_state.errorCounter >= _state.maxErrorsBeforeReset && !options.preventReset) {
            console.warn(`⚠️ Core: Досягнуто критичної кількості помилок (${_state.errorCounter}), показуємо повідомлення...`);

            showErrorMessage('Виникли проблеми з підключенням до сервера. Перевіряємо стан...', 'error');

            // Запускаємо перевірку здоров'я
            await checkApiHealth();
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
     * Отримання даних користувача з перевіркою готовності
     */
    async function getUserData(forceRefresh = false) {
        try {
            console.log("🔄 Core: Запит даних користувача");

            // Перевіряємо готовність системи
            if (!_state.serverHealthy && !forceRefresh) {
                console.warn("⚠️ Core: Сервер недоступний, спробуємо перевірити...");
                const isHealthy = await checkApiHealth();
                if (!isHealthy) {
                    console.error("❌ Core: Сервер все ще недоступний");
                    return {};
                }
            }

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

            // Показуємо інформативне повідомлення
            if (error.message.includes('недоступний') || error.message.includes('500')) {
                showErrorMessage('Сервер тимчасово недоступний. Намагаємося відновити підключення...', 'warning');
            }

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

            // Показуємо першу літеру імені
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
     * Оновлення локального балансу (тільки візуально, без збереження)
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
                    source: source || 'core.js',
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
     * Оновлення балансу з сервера
     */
    async function refreshBalance(forceRefresh = false) {
        console.log("🔄 Core: Запит оновлення балансу");

        // Перевіряємо готовність сервера
        if (!_state.serverHealthy && !forceRefresh) {
            console.warn("⚠️ Core: Сервер недоступний для оновлення балансу");
            return {
                success: false,
                message: 'Сервер тимчасово недоступний'
            };
        }

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
                timeout: _config.requestTimeout
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

                _state.errorCounter = Math.max(0, _state.errorCounter - 1);

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

            // Показуємо відповідне повідомлення
            if (error.message.includes('недоступний') || error.message.includes('500')) {
                showErrorMessage('Сервер тимчасово недоступний', 'warning');
            } else if (_state.errorCounter >= _state.maxErrorsBeforeReset) {
                showErrorMessage('Виникли проблеми з підключенням', 'error');
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
            console.warn('⚠️ Core: Помилка ініціалізації навігації:', e);
        }
    }

    // ======== СИНХРОНІЗАЦІЯ ДАНИХ ========

    /**
     * Синхронізація даних користувача з сервером
     */
    async function syncUserData(forceRefresh = false) {
        try {
            console.log('🔄 Core: Початок синхронізації даних користувача...');

            // Перевіряємо готовність сервера
            if (!_state.serverHealthy && !forceRefresh) {
                console.warn('⚠️ Core: Сервер недоступний для синхронізації');
                return {
                    success: false,
                    message: 'Сервер тимчасово недоступний',
                    data: _userData || {}
                };
            }

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

            const isServerError = error.message.includes('недоступний') || error.message.includes('500');

            if (isServerError) {
                showErrorMessage('Сервер тимчасово недоступний. Намагаємося відновити підключення...', 'warning');
            } else {
                showErrorMessage('Не вдалося синхронізувати дані', 'warning');
            }

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
    function startAutoSync(interval = 180000) { // 3 хвилини
        if (_state.refreshInterval) {
            clearInterval(_state.refreshInterval);
            _state.refreshInterval = null;
        }

        _state.refreshInterval = setInterval(async () => {
            try {
                // Синхронізуємо тільки якщо сервер здоровий
                if (_state.serverHealthy && Date.now() - _state.lastRequestTime >= _config.minRequestInterval && !_state.requestInProgress) {
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

        if (_state.healthCheckInterval) {
            clearInterval(_state.healthCheckInterval);
            _state.healthCheckInterval = null;
            console.log("⏹️ Core: Health check зупинено");
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

            // Запускаємо перевірку здоров'я API
            startHealthCheck();

            // Чекаємо готовності API
            let apiWaitAttempts = 0;
            const maxApiWaitAttempts = 10;

            while (!hasApiModule() && apiWaitAttempts < maxApiWaitAttempts) {
                console.log(`⏳ Core: Чекаємо завантаження API модуля... (${apiWaitAttempts + 1}/${maxApiWaitAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 500));
                apiWaitAttempts++;
            }

            if (!hasApiModule()) {
                console.error("❌ Core: API модуль не завантажився");
                showErrorMessage('Помилка завантаження системи. Оновіть сторінку.', 'error');
                return false;
            }

            // Перевіряємо Telegram ID
            const telegramId = getTelegramUserId();
            if (!telegramId) {
                console.error("❌ Core: Немає Telegram ID, блокуємо ініціалізацію");
                showErrorMessage('Додаток повинен бути відкритий через Telegram', 'error');
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

            // Чекаємо готовності сервера
            if (!_state.serverHealthy) {
                console.log("⏳ Core: Чекаємо готовності сервера...");
                await new Promise(resolve => setTimeout(resolve, 2000)); // Даємо час на перевірку
            }

            // Отримуємо дані користувача (можемо працювати і без сервера на початку)
            try {
                await getUserData();
                console.log("✅ Core: Дані користувача отримано");
            } catch (error) {
                console.warn("⚠️ Core: Не вдалося отримати дані користувача:", error);
                // Продовжуємо ініціалізацію навіть без даних
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

            console.log("✅ Core: Ядро WINIX успішно ініціалізовано");

            // Викликаємо подію ініціалізації
            document.dispatchEvent(new CustomEvent('winix-initialized'));

            return true;
        } catch (error) {
            console.error('❌ Core: Помилка ініціалізації ядра WINIX:', error);

            showErrorMessage('Помилка ініціалізації системи', 'error');

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

    /**
     * Отримати стан системи
     */
    function getSystemStatus() {
        return {
            initialized: _state.initialized,
            apiReady: _state.apiReady,
            serverHealthy: _state.serverHealthy,
            errorCounter: _state.errorCounter,
            lastHealthCheck: _state.apiStats.lastHealthCheck,
            stats: { ..._state.apiStats }
        };
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

    // Обробник online/offline
    window.addEventListener('online', () => {
        console.log('🌐 Core: З\'єднання відновлено');
        checkApiHealth(); // Перевіряємо сервер при відновленні з'єднання
    });

    window.addEventListener('offline', () => {
        console.log('📵 Core: З\'єднання втрачено');
        _state.serverHealthy = false;
        updateServerStatusUI(false);
    });

    // ======== ПУБЛІЧНИЙ API ========

    window.WinixCore = {
        // Метадані
        version: '3.1.0',
        isInitialized: isInitialized,
        getSystemStatus: getSystemStatus,

        // Утиліти
        getElement,
        formatCurrency,
        executeApiRequest,
        showErrorMessage,

        // API Health
        checkApiHealth,

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

    console.log("✅ Core: Модуль успішно завантажено (Fixed Version)");
    // Позначаємо модуль як готовий
    if (window.WinixInit) {
        window.WinixInit.checkModule('core');
    }
})();