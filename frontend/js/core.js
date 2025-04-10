/**
 * core.js - Базова функціональність WINIX
 * Вдосконалена версія з покращеною синхронізацією модулів
 */

(function() {
    'use strict';

    console.log("🔄 Core: Ініціалізація ядра WINIX");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Дані користувача
    let _userData = null;

    // Час останнього оновлення даних
    let _lastUserDataUpdateTime = 0;

    // Час останнього запиту даних
    let _lastRequestTime = 0;

    // Мінімальний інтервал між запитами
    const MIN_REQUEST_INTERVAL = 5000; // 5 секунд, узгоджено з API та AUTH

    // Інтервал автооновлення
    let _refreshInterval = null;

    // Прапорець для індикатора завантаження
    let _loaderVisible = false;

    // Прапорець для запиту даних
    let _fetchingUserData = false;

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
        } catch (e) {
            console.error(`Помилка збереження в localStorage: ${key}`, e);
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

    // ======== ФУНКЦІЇ КОРИСТУВАЧА ========

    /**
     * Отримання даних користувача
     * @param {boolean} forceRefresh - Примусово оновити
     */
    async function getUserData(forceRefresh = false) {
        // ЗМІНЕНО: Додано перевірку на частоту запитів
        const now = Date.now();
        const timeSinceLastRequest = now - _lastRequestTime;

        // Якщо запити занадто часті і є дані - використовуємо кеш
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && _userData && !forceRefresh) {
            console.log(`📋 Core: Використання кешованих даних користувача (${Math.floor(timeSinceLastRequest/1000)}с з останнього запиту)`);
            return _userData;
        }

        // Якщо у нас вже є дані і не потрібно оновлювати
        if (_userData && !forceRefresh) {
            return _userData;
        }

        // Запобігання паралельним запитам
        if (_fetchingUserData) {
            console.log("⏳ Core: Запит даних користувача вже виконується");
            return _userData || {}; // Повертаємо існуючі дані або порожній об'єкт
        }

        _fetchingUserData = true;
        _lastRequestTime = now;

        try {
            // ЗМІНЕНО: Додано перехоплення та обробку помилок, використовуємо forceRefresh=false
            // для кращої координації з API модулем
            const response = await window.WinixAPI.getUserData(forceRefresh);

            if (response.status === 'success' && response.data) {
                _userData = response.data;
                _lastUserDataUpdateTime = now;

                // Зберігаємо дані в localStorage
                saveToStorage('userData', _userData);

                // Оновлюємо баланс
                if (_userData.balance !== undefined) {
                    saveToStorage('userTokens', _userData.balance);
                    saveToStorage('winix_balance', _userData.balance);
                }

                if (_userData.coins !== undefined) {
                    saveToStorage('userCoins', _userData.coins);
                    saveToStorage('winix_coins', _userData.coins);
                }

                // ДОДАНО: Генеруємо подію оновлення даних для інших модулів
                document.dispatchEvent(new CustomEvent('user-data-updated', {
                    detail: _userData,
                    source: 'core.js'
                }));

                // Повертаємо дані
                return _userData;
            } else if (response.source && response.source.includes('cache')) {
                // Використовуємо кешовані дані з API
                _userData = response.data;
                _lastUserDataUpdateTime = now;

                return _userData;
            } else {
                throw new Error(response.message || 'Не вдалося отримати дані користувача');
            }
        } catch (error) {
            console.error('Помилка отримання даних користувача:', error);

            // ЗМІНЕНО: Більш детальна обробка помилок
            if (error.source === 'throttle') {
                console.warn(`⏳ Core: Обмеження частоти запитів. Наступна спроба через ${Math.ceil(error.retryAfter/1000)}с`);

                // Якщо є затримка запиту - плануємо автоматичну повторну спробу
                if (error.retryAfter && error.retryAfter > 0) {
                    setTimeout(() => {
                        _fetchingUserData = false;
                        getUserData(true);
                    }, error.retryAfter + 100);
                }

                return _userData || {};
            }

            // У випадку помилки використовуємо дані з localStorage
            const storedUserData = getFromStorage('userData', null, true);
            if (storedUserData) {
                _userData = storedUserData;
                return _userData;
            }

            // Створюємо мінімальні дані користувача
            _userData = {
                telegram_id: window.WinixAPI.getUserId() || 'unknown',
                balance: parseFloat(getFromStorage('userTokens', '0')),
                coins: parseInt(getFromStorage('userCoins', '0'))
            };

            return _userData;
        } finally {
            _fetchingUserData = false;
        }
    }

    /**
     * Оновлення відображення користувача
     */
    function updateUserDisplay() {
        try {
            // Оновлюємо ID користувача
            const userIdElement = getElement('#user-id');
            if (userIdElement) {
                userIdElement.textContent = _userData?.telegram_id ||
                                           window.WinixAPI.getUserId() ||
                                           getFromStorage('telegram_user_id', 'Unknown ID');
            }

            // Оновлюємо ім'я користувача
            const usernameElement = getElement('#username');
            if (usernameElement && _userData?.username) {
                usernameElement.textContent = _userData.username;
            }

            // Оновлюємо аватар
            updateUserAvatar();
        } catch (e) {
            console.error('Помилка оновлення відображення користувача:', e);
        }
    }

    /**
     * Оновлення аватара користувача
     */
    function updateUserAvatar() {
        try {
            const avatarElement = getElement('#profile-avatar');
            if (!avatarElement) return;

            // Очищаємо вміст аватара
            avatarElement.innerHTML = '';

            // Перевіряємо наявність зображення аватара
            const username = _userData?.username || getFromStorage('username', 'User');
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
            // ЗМІНЕНО: Перевіряємо частоту запитів
            const now = Date.now();
            if ((now - _lastRequestTime) < MIN_REQUEST_INTERVAL) {
                console.log(`⏳ Core: Занадто частий запит балансу (${Math.floor((now - _lastRequestTime)/1000)}с)`);
                return {
                    success: true,
                    data: {
                        balance: getBalance(),
                        coins: getCoins()
                    },
                    source: 'cache'
                };
            }

            _lastRequestTime = now;

            // Отримуємо баланс з API
            const response = await window.WinixAPI.getBalance();

            if (response.status === 'success' && response.data) {
                // Оновлюємо дані користувача
                if (!_userData) _userData = {};

                _userData.balance = response.data.balance || _userData.balance;
                _userData.coins = response.data.coins || _userData.coins;

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
                    }
                }));

                return {
                    success: true,
                    data: {
                        balance: _userData.balance,
                        coins: _userData.coins
                    }
                };
            } else {
                throw new Error(response.message || 'Не вдалося оновити баланс');
            }
        } catch (error) {
            console.error('Помилка оновлення балансу:', error);

            // У випадку помилки використовуємо кешовані дані
            updateBalanceDisplay();

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
            // ЗМІНЕНО: Перевіряємо, чи не було оновлення з іншого модуля нещодавно
            const now = Date.now();
            if ((now - _lastUserDataUpdateTime) < 10000) { // Якщо дані оновлювались менше 10 секунд тому
                console.log("📋 Core: Дані користувача оновлені нещодавно, пропускаємо запит");
                return {
                    success: true,
                    data: _userData,
                    source: 'recently_updated'
                };
            }

            if ((now - _lastRequestTime) < MIN_REQUEST_INTERVAL) {
                console.log(`⏳ Core: Занадто частий запит, залишилось ${Math.ceil((MIN_REQUEST_INTERVAL - (now - _lastRequestTime))/1000)}с`);
                return {
                    success: true,
                    data: _userData,
                    source: 'throttled'
                };
            }

            if (_fetchingUserData) {
                console.log("⏳ Core: Синхронізація вже виконується");
                return {
                    success: true,
                    data: _userData,
                    source: 'in_progress'
                };
            }

            // Отримуємо дані користувача (forceRefresh=false для використання кешу API)
            const userData = await getUserData(false);

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            return {
                success: true,
                data: userData
            };
        } catch (error) {
            console.error('Помилка синхронізації даних користувача:', error);

            // У випадку помилки використовуємо кешовані дані
            updateUserDisplay();
            updateBalanceDisplay();

            return {
                success: false,
                message: error.message || 'Не вдалося синхронізувати дані користувача'
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
        }

        // Запускаємо періодичну синхронізацію
        _refreshInterval = setInterval(async () => {
            try {
                // ЗМІНЕНО: Перевіряємо умови перед запуском синхронізації
                const now = Date.now();
                if ((now - _lastUserDataUpdateTime) < 60000) {
                    // Якщо дані оновлювались менше хвилини тому, пропускаємо
                    console.log("📋 Core: Дані користувача оновлені нещодавно, пропускаємо автоматичну синхронізацію");
                    return;
                }

                if ((now - _lastRequestTime) < MIN_REQUEST_INTERVAL || _fetchingUserData) {
                    // Занадто частий запит або вже виконується запит
                    console.log("⏳ Core: Пропускаємо автоматичну синхронізацію через обмеження");
                    return;
                }

                console.log("🔄 Core: Виконання автоматичної синхронізації даних");
                await syncUserData();
            } catch (e) {
                console.warn('Помилка автоматичної синхронізації:', e);
            }
        }, interval);

        console.log(`🔄 Core: Запущено автоматичну синхронізацію з інтервалом ${interval/1000}с`);
    }

    /**
     * Зупинка періодичної синхронізації
     */
    function stopAutoSync() {
        if (_refreshInterval) {
            clearInterval(_refreshInterval);
            _refreshInterval = null;
            console.log("⏹️ Core: Автоматичну синхронізацію зупинено");
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

            // ДОДАНО: Обробник подій для координації з іншими модулями
            document.addEventListener('user-data-updated', function(event) {
                if (event.detail && event.source !== 'core.js') {
                    console.log("📋 Core: Отримано оновлені дані користувача з іншого модуля");
                    _userData = event.detail;
                    _lastUserDataUpdateTime = Date.now();
                    updateUserDisplay();
                    updateBalanceDisplay();
                }
            });

            // ДОДАНО: Реакція на помилки API
            document.addEventListener('api-error', function(event) {
                console.warn("⚠️ Core: Отримано повідомлення про помилку API:", event.detail.error.message);
            });

            // Отримуємо дані користувача з використанням API
            // ЗМІНЕНО: форсувати оновлення не потрібно, API сам вирішить, чи використовувати кеш
            await getUserData(false);

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            // Ініціалізуємо навігацію
            initNavigation();

            // Запускаємо автоматичну синхронізацію
            // ЗМІНЕНО: збільшено інтервал для узгодження з іншими модулями
            const isSettingsPage = window.location.pathname.includes('general.html');
            if (!isSettingsPage) {
                startAutoSync(120000); // 2 хвилини, рідше ніж раніше для уникнення конфліктів
            }

            console.log("✅ Core: Ядро WINIX успішно ініціалізовано");

            // Викликаємо подію ініціалізації
            document.dispatchEvent(new CustomEvent('winix-initialized'));
        } catch (error) {
            console.error('Помилка ініціалізації ядра WINIX:', error);

            // У випадку помилки використовуємо кешовані дані
            updateUserDisplay();
            updateBalanceDisplay();

            document.dispatchEvent(new CustomEvent('winix-initialization-error', { detail: error }));
        }
    }

    // ======== ПУБЛІЧНИЙ API ========

    // Експортуємо публічний API
    window.WinixCore = {
        // Утиліти
        getElement,
        saveToStorage,
        getFromStorage,
        formatCurrency,

        // Функції користувача
        getUserData,
        updateUserDisplay,
        getBalance,
        getCoins,
        updateBalanceDisplay,
        refreshBalance,

        // Функції для синхронізації даних
        syncUserData,
        startAutoSync,
        stopAutoSync
    };

    // Ініціалізуємо ядро при завантаженні сторінки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ДОДАНО: Обробник подій зміни сторінки
    window.addEventListener('popstate', function() {
        const isSettingsPage = window.location.pathname.includes('general.html');
        if (isSettingsPage) {
            stopAutoSync();
        } else {
            startAutoSync(120000);
        }
    });
})();