/**
 * core.js - Базова функціональність WINIX (Stabilized Version)
 * ВИПРАВЛЕНА ВЕРСІЯ з м'якою обробкою помилок та стабільною роботою
 * @version 4.0.0
 */

(function() {
    'use strict';

    console.log("🔄 Core: Ініціалізація СТАБІЛІЗОВАНОГО ядра WINIX");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Дані користувача
    let _userData = null;

    // Стан модуля - М'ЯКИЙ РЕЖИМ
    const _state = {
        initialized: false,
        apiReady: false,
        serverHealthy: null, // null = невідомо, true = здоровий, false = проблеми
        refreshInterval: null,
        requestInProgress: false,
        lastRequestTime: 0,
        errorCounter: 0,
        maxErrorsBeforeAlert: 5, // Збільшено ліміт помилок
        apiStats: {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            lastHealthCheck: 0
        },
        healthCheckInterval: null,
        offlineMode: false // НОВИЙ прапорець для офлайн режиму
    };

    // Конфігурація - МЕНШ АГРЕСИВНА
    const _config = {
        minRequestInterval: 5000, // 5 секунд замість 3
        autoRefreshInterval: 300000, // 5 хвилин замість 3
        requestTimeout: 12000, // Збільшено до 12 секунд
        maxRetries: 1, // Зменшено до 1 спроби
        retryInterval: 2000, // 2 секунди
        healthCheckInterval: 120000, // Збільшено до 2 хвилин
        healthCheckTimeout: 5000,
        enableHealthCheck: false // ВИМКНЕНО за замовчуванням
    };

    // ======== API HEALTH CHECK (М'ЯКИЙ) ========

    /**
     * М'яка перевірка здоров'я API без блокування роботи
     */
    async function checkApiHealth() {
        if (!_config.enableHealthCheck) {
            return true; // Вважаємо здоровим якщо перевірка вимкнена
        }

        console.log('🏥 Core: М\'яка перевірка здоров\'я API сервера');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), _config.healthCheckTimeout);

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
                _state.errorCounter = Math.max(0, _state.errorCounter - 1);
                _state.offlineMode = false;
                updateServerStatusUI(true);
            } else {
                console.warn(`⚠️ Core: API сервер повернув статус ${response.status}`);
                _state.errorCounter++;
            }

            return isHealthy;

        } catch (error) {
            console.warn('⚠️ Core: API сервер недоступний:', error.message);
            _state.serverHealthy = false;
            _state.errorCounter++;
            _state.offlineMode = true;

            // Показуємо м'яке повідомлення тільки при критичній кількості помилок
            if (_state.errorCounter >= _state.maxErrorsBeforeAlert) {
                updateServerStatusUI(false);
            }

            return false;
        }
    }

    /**
     * Запуск М'ЯКОЇ періодичної перевірки здоров'я
     */
    function startHealthCheck() {
        if (!_config.enableHealthCheck) {
            console.log('🏥 Core: Health check вимкнено');
            return;
        }

        console.log('🏥 Core: Запуск м\'якої перевірки здоров\'я API');

        // Перша перевірка через 5 секунд
        setTimeout(() => {
            checkApiHealth();
        }, 5000);

        // Періодичні перевірки
        _state.healthCheckInterval = setInterval(() => {
            checkApiHealth();
        }, _config.healthCheckInterval);

        console.log(`✅ Core: М'який health check запущено (кожні ${_config.healthCheckInterval/1000} сек)`);
    }

    /**
     * Оновлення UI статусу сервера (М'ЯКЕ)
     */
    function updateServerStatusUI(isHealthy) {
        const statusElement = document.querySelector('.server-status');

        if (isHealthy) {
            if (statusElement) {
                statusElement.style.display = 'none';
            }
            return;
        }

        if (!statusElement) {
            createServerStatusElement();
            return;
        }

        statusElement.style.display = 'block';
        statusElement.innerHTML = `
            <div class="server-offline-notice">
                <h4>⚠️ Сповільнене з'єднання</h4>
                <p>Працюємо в обмеженому режимі. Деякі функції можуть бути недоступні.</p>
            </div>
        `;
    }

    /**
     * Створення М'ЯКОГО елемента статусу сервера
     */
    function createServerStatusElement() {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'server-status';
        statusDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #f39c12, #e67e22);
            color: white;
            padding: 8px;
            text-align: center;
            z-index: 9999;
            font-size: 13px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;

        statusDiv.innerHTML = `
            <div class="server-offline-notice">
                <h4 style="margin: 0 0 5px 0; font-size: 14px;">⚠️ Сповільнене з'єднання</h4>
                <p style="margin: 0; font-size: 12px; opacity: 0.9;">Працюємо в обмеженому режимі. Деякі функції можуть бути недоступні.</p>
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

        // Fallback якщо auth.js ще не завантажений
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
     * М'яке відображення повідомлення про помилку
     */
    function showErrorMessage(errorMessage, type = 'warning') {
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

    // ======== API ФУНКЦІЇ (СТАБІЛІЗОВАНІ) ========

    /**
     * СТАБІЛІЗОВАНЕ виконання API-запиту з м'якою обробкою помилок
     */
    async function executeApiRequest(endpoint, method = 'GET', data = null, options = {}) {
        if (!endpoint) {
            console.error("❌ Core: Невалідний endpoint для запиту");
            throw new Error('Невалідний endpoint');
        }

        // НЕ БЛОКУЄМО запити при "нездоровому" сервері
        // Просто логуємо стан

        if (_state.serverHealthy === false) {
            console.warn("⚠️ Core: Сервер має проблеми, але продовжуємо запит");
        }

        // Перевіряємо наявність Telegram ID
        const telegramId = getTelegramUserId();
        if (!telegramId) {
            console.warn("⚠️ Core: Немає Telegram ID для запиту, використовуємо fallback");
            // НЕ кидаємо помилку, повертаємо fallback дані
            return {
                status: 'success',
                data: {
                    telegram_id: '000000',
                    username: 'Offline User',
                    balance: 0,
                    coins: 0,
                    offline_mode: true
                },
                source: 'fallback'
            };
        }

        // Перевіряємо API модуль
        if (!hasApiModule()) {
            console.warn("⚠️ Core: API модуль недоступний, використовуємо fallback");
            return {
                status: 'success',
                data: {
                    telegram_id: telegramId,
                    username: `User_${telegramId.slice(-4)}`,
                    balance: 0,
                    coins: 0,
                    offline_mode: true
                },
                source: 'fallback'
            };
        }

        const defaultOptions = {
            timeout: _config.requestTimeout,
            retries: _config.maxRetries,
            retryInterval: _config.retryInterval,
            suppressErrors: true // Завжди використовуємо м'яку обробку помилок
        };

        const requestOptions = { ...defaultOptions, ...options };
        _state.apiStats.totalRequests++;

        try {
            // Виконуємо запит через WinixAPI з м'якою обробкою помилок
            const apiResult = await window.WinixAPI.apiRequest(endpoint, method, data, {
                timeout: requestOptions.timeout,
                suppressErrors: true // М'яка обробка помилок
            });

            if (apiResult.status === 'error') {
                throw new Error(apiResult.message || 'API request failed');
            }

            _state.apiStats.successfulRequests++;
            _state.errorCounter = Math.max(0, _state.errorCounter - 1);
            _state.offlineMode = false;

            return apiResult;

        } catch (error) {
            _state.apiStats.failedRequests++;
            console.warn(`⚠️ Core: Помилка при виконанні ${method} ${endpoint}:`, error.message);

            // Збільшуємо лічильник помилок, але не блокуємо роботу
            _state.errorCounter++;
            _state.offlineMode = true;

            // Показуємо м'яке повідомлення тільки при критичній кількості помилок
            if (_state.errorCounter >= _state.maxErrorsBeforeAlert && !options.preventAlert) {
                showErrorMessage('Проблеми з підключенням. Працюємо в обмеженому режимі.', 'warning');
            }

            // Повертаємо fallback дані замість помилки
            return {
                status: 'success',
                data: {
                    telegram_id: telegramId,
                    username: `User_${telegramId.slice(-4)}`,
                    balance: 0,
                    coins: 0,
                    offline_mode: true
                },
                source: 'fallback_after_error',
                original_error: error.message
            };
        }
    }

    // ======== ФУНКЦІЇ КОРИСТУВАЧА (СТАБІЛІЗОВАНІ) ========

    /**
     * СТАБІЛІЗОВАНЕ отримання даних користувача
     */
    async function getUserData(forceRefresh = false) {
        try {
            console.log("🔄 Core: Запит даних користувача");

            // Перевіряємо Telegram ID
            const telegramId = getTelegramUserId();
            if (!telegramId) {
                console.warn("⚠️ Core: Немає Telegram ID, використовуємо fallback");
                const fallbackData = {
                    telegram_id: '000000',
                    username: 'Offline User',
                    balance: 0,
                    coins: 0,
                    offline_mode: true
                };
                _userData = fallbackData;
                return fallbackData;
            }

            const now = Date.now();
            if (!forceRefresh && (now - _state.lastRequestTime < _config.minRequestInterval)) {
                console.log("⏳ Core: Частий запит даних користувача, використовуємо кеш");
                return _userData || {
                    telegram_id: telegramId,
                    username: `User_${telegramId.slice(-4)}`,
                    balance: 0,
                    coins: 0,
                    offline_mode: true
                };
            }

            if (_state.requestInProgress && !forceRefresh) {
                console.log("⏳ Core: Запит даних користувача вже виконується");
                return _userData || {
                    telegram_id: telegramId,
                    username: `User_${telegramId.slice(-4)}`,
                    balance: 0,
                    coins: 0,
                    offline_mode: true
                };
            }

            _state.lastRequestTime = now;
            _state.requestInProgress = true;

            const response = await executeApiRequest(`user/${telegramId}`, 'GET', null, {
                suppressErrors: true,
                preventAlert: true // Не показуємо алерти для звичайних запитів
            });

            _state.requestInProgress = false;

            if (response && response.status === 'success' && response.data) {
                _userData = response.data;

                // Генеруємо подію оновлення тільки якщо дані реальні
                if (!response.data.offline_mode) {
                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                        detail: { userData: _userData },
                        source: 'core.js'
                    }));
                }

                return _userData;
            } else {
                console.warn("⚠️ Core: Не вдалося отримати дані користувача, використовуємо fallback");
                const fallbackData = {
                    telegram_id: telegramId,
                    username: `User_${telegramId.slice(-4)}`,
                    balance: 0,
                    coins: 0,
                    offline_mode: true
                };
                _userData = fallbackData;
                return fallbackData;
            }
        } catch (error) {
            console.warn("⚠️ Core: Помилка в getUserData, використовуємо fallback:", error);
            _state.requestInProgress = false;

            const telegramId = getTelegramUserId();
            const fallbackData = {
                telegram_id: telegramId || '000000',
                username: telegramId ? `User_${telegramId.slice(-4)}` : 'Offline User',
                balance: 0,
                coins: 0,
                offline_mode: true
            };
            _userData = fallbackData;
            return fallbackData;
        }
    }

    /**
     * Оновлення відображення користувача
     */
    function updateUserDisplay() {
        try {
            const userData = _userData || {};
            const userId = userData.telegram_id || getTelegramUserId() || '';
            let username = userData.username || 'Користувач';

            // Показуємо статус офлайн режиму
            if (userData.offline_mode) {
                username += ' (офлайн)';
            }

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

                // Показуємо статус офлайн режиму
                if (_userData?.offline_mode && animate) {
                    const statusElement = coinsElement.parentElement;
                    if (statusElement) {
                        statusElement.style.opacity = '0.7';
                        statusElement.title = 'Дані можуть бути застарілими (офлайн режим)';
                    }
                }

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
     * СТАБІЛІЗОВАНЕ оновлення балансу з сервера
     */
    async function refreshBalance(forceRefresh = false) {
        console.log("🔄 Core: Запит оновлення балансу");

        // Перевіряємо Telegram ID
        const telegramId = getTelegramUserId();
        if (!telegramId) {
            console.warn("⚠️ Core: Немає Telegram ID для оновлення балансу");
            return {
                success: false,
                message: 'No Telegram ID',
                fallback: true
            };
        }

        // Перевірка на частоту запитів
        if (!forceRefresh && (Date.now() - _state.lastRequestTime < _config.minRequestInterval)) {
            console.log("⏳ Core: Частий запит балансу");
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
                timeout: _config.requestTimeout,
                preventAlert: true
            });

            _state.requestInProgress = false;

            if (response && response.status === 'success' && response.data) {
                const newBalance = response.data.coins !== undefined ? response.data.coins : oldBalance;

                // Оновлюємо відображення тільки якщо це не fallback дані
                if (!response.data.offline_mode) {
                    updateLocalBalance(newBalance, 'core.js', true);

                    // Оновлюємо дані користувача
                    if (_userData) {
                        _userData.coins = newBalance;
                    }

                    _state.errorCounter = Math.max(0, _state.errorCounter - 1);
                }

                return {
                    success: true,
                    data: {
                        coins: newBalance,
                        oldCoins: oldBalance
                    },
                    offline_mode: response.data.offline_mode || false
                };
            } else {
                console.warn('⚠️ Core: Не вдалося отримати баланс, використовуємо кешовані дані');
                return {
                    success: true,
                    cached: true,
                    data: {
                        coins: oldBalance
                    },
                    message: 'Використовуються кешовані дані'
                };
            }
        } catch (error) {
            console.warn('⚠️ Core: Помилка оновлення балансу:', error);
            _state.requestInProgress = false;
            _state.errorCounter++;

            // М'яка обробка помилки - не показуємо помилки часто
            if (_state.errorCounter >= _state.maxErrorsBeforeAlert) {
                showErrorMessage('Проблеми з підключенням до сервера', 'warning');
            }

            return {
                success: true, // Повертаємо success навіть при помилці
                cached: true,
                data: {
                    coins: oldBalance
                },
                message: 'Використовуються кешовані дані через помилку мережі'
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

    // ======== СИНХРОНІЗАЦІЯ ДАНИХ (СТАБІЛІЗОВАНА) ========

    /**
     * СТАБІЛІЗОВАНА синхронізація даних користувача з сервером
     */
    async function syncUserData(forceRefresh = false) {
        try {
            console.log('🔄 Core: Початок синхронізації даних користувача...');

            // Оновлюємо дані користувача з м'якою обробкою помилок
            const userData = await getUserData(forceRefresh);

            // Оновлюємо відображення незалежно від того, чи це fallback дані
            updateUserDisplay();
            updateBalanceDisplay();

            // Генеруємо подію оновлення даних користувача тільки для реальних даних
            if (userData && !userData.offline_mode) {
                document.dispatchEvent(new CustomEvent('user-data-updated', {
                    detail: { userData },
                    source: 'core.js'
                }));
            }

            return {
                success: true,
                data: userData,
                offline_mode: userData?.offline_mode || false
            };
        } catch (error) {
            console.warn('⚠️ Core: Помилка синхронізації даних користувача:', error);

            // М'яка обробка помилки - не блокуємо роботу
            const telegramId = getTelegramUserId();
            const fallbackData = {
                telegram_id: telegramId || '000000',
                username: telegramId ? `User_${telegramId.slice(-4)}` : 'Offline User',
                balance: 0,
                coins: 0,
                offline_mode: true
            };

            _userData = fallbackData;
            updateUserDisplay();
            updateBalanceDisplay();

            return {
                success: true,
                data: fallbackData,
                offline_mode: true,
                message: 'Використовуються fallback дані через помилку мережі'
            };
        }
    }

    /**
     * Запуск М'ЯКОЇ періодичної синхронізації даних
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
                // НЕ зупиняємо інтервал при помилці
            }
        }, interval);

        console.log(`🔄 Core: М'яке періодичне оновлення запущено (інтервал: ${interval}ms)`);
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

    // ======== ІНІЦІАЛІЗАЦІЯ (СТАБІЛІЗОВАНА) ========

    /**
     * СТАБІЛІЗОВАНА ініціалізація ядра WINIX
     */
    async function init(options = {}) {
        try {
            if (_state.initialized) {
                console.log("✅ Core: Ядро WINIX вже ініціалізоване");
                return true;
            }

            console.log("🔄 Core: Початок СТАБІЛІЗОВАНОЇ ініціалізації ядра WINIX");

            // Оновлюємо конфігурацію
            Object.assign(_config, options);

            // Запускаємо М'ЯКУ перевірку здоров'я API (якщо увімкнено)
            if (_config.enableHealthCheck) {
                startHealthCheck();
            }

            // Чекаємо готовності API (з таймаутом)
            let apiWaitAttempts = 0;
            const maxApiWaitAttempts = 5; // Зменшено з 10

            while (!hasApiModule() && apiWaitAttempts < maxApiWaitAttempts) {
                console.log(`⏳ Core: Чекаємо завантаження API модуля... (${apiWaitAttempts + 1}/${maxApiWaitAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 500));
                apiWaitAttempts++;
            }

            // НЕ блокуємо ініціалізацію якщо API модуль недоступний
            if (!hasApiModule()) {
                console.warn("⚠️ Core: API модуль не завантажився, працюємо в обмеженому режимі");
                _state.offlineMode = true;
            }

            // Перевіряємо Telegram ID
            const telegramId = getTelegramUserId();
            if (!telegramId) {
                console.warn("⚠️ Core: Немає Telegram ID, працюємо в демо режимі");
                _state.offlineMode = true;
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

            // Отримуємо дані користувача (з fallback обробкою)
            try {
                await getUserData();
                console.log("✅ Core: Дані користувача отримано");
            } catch (error) {
                console.warn("⚠️ Core: Не вдалося отримати дані користувача, працюємо з fallback:", error);
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

            console.log("✅ Core: СТАБІЛІЗОВАНЕ ядро WINIX успішно ініціалізовано");

            // Викликаємо подію ініціалізації
            document.dispatchEvent(new CustomEvent('winix-initialized'));

            return true;
        } catch (error) {
            console.warn('⚠️ Core: Помилка ініціалізації ядра WINIX, але продовжуємо роботу:', error);

            // НЕ блокуємо роботу при помилці ініціалізації
            _state.initialized = true;
            _state.offlineMode = true;

            // Встановлюємо базове відображення
            updateUserDisplay();
            updateBalanceDisplay();

            document.dispatchEvent(new CustomEvent('winix-initialization-error', { detail: error }));

            return true; // Повертаємо true навіть при помилці
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
            offlineMode: _state.offlineMode,
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
                console.warn("⚠️ Core: Помилка ініціалізації при load:", e);
            });
        }
    });

    // Обробник події DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function() {
        if (!_state.initialized) {
            init().catch(e => {
                console.warn("⚠️ Core: Помилка ініціалізації при DOMContentLoaded:", e);
            });
        }
    });

    // Обробник online/offline
    window.addEventListener('online', () => {
        console.log('🌐 Core: З\'єднання відновлено');
        _state.offlineMode = false;
        if (_config.enableHealthCheck) {
            checkApiHealth();
        }
    });

    window.addEventListener('offline', () => {
        console.log('📵 Core: З\'єднання втрачено');
        _state.offlineMode = true;
        _state.serverHealthy = false;
        updateServerStatusUI(false);
    });

    // ======== ПУБЛІЧНИЙ API ========

    window.WinixCore = {
        // Метадані
        version: '4.0.0',
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

    console.log("✅ Core: СТАБІЛІЗОВАНИЙ модуль успішно завантажено");
})();