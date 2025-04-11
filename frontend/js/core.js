/**
 * core.js - Базова функціональність WINIX
 * Оптимізована версія з покращеною інтеграцією з API та Auth модулями
 * @version 1.1.0
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

    // Мінімальний інтервал між запитами
    const MIN_REQUEST_INTERVAL = 5000; // 5 секунд

    // Перевірка доступності модулів
    const hasApiModule = () => window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function';
    const hasAuthModule = () => window.WinixAuth && typeof window.WinixAuth.getUserData === 'function';

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
        // Перевіряємо частоту запитів
        const now = Date.now();
        if (!forceRefresh && (now - _lastRequestTime < MIN_REQUEST_INTERVAL)) {
            console.log("🔄 Core: Занадто частий запит даних користувача, використовуємо кеш");
            // Якщо у нас вже є дані і не потрібно оновлювати
            if (_userData) {
                return _userData;
            }
        }

        _lastRequestTime = now;

        try {
            // Перевіряємо наявність модулів
            if (hasAuthModule()) {
                // Використовуємо WinixAuth, якщо доступний
                const userData = await window.WinixAuth.getUserData(forceRefresh);

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

                if (response && response.status === 'success' && response.data) {
                    _userData = response.data;

                    // Оновлюємо дані в localStorage
                    saveToStorage('userData', _userData);

                    // Генеруємо подію оновлення
                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                        detail: { userData: _userData },
                        source: 'core.js'
                    }));

                    return _userData;
                }
            } else {
                // Якщо немає модулів - використовуємо дані з localStorage
                const storedUserData = getFromStorage('userData', null, true);
                if (storedUserData) {
                    _userData = storedUserData;
                    return _userData;
                }

                throw new Error('API та Auth модулі недоступні');
            }
        } catch (error) {
            console.error('Помилка отримання даних користувача:', error);

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
                coins: parseInt(getFromStorage('userCoins', '0'))
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
            return window.WinixAPI.getUserId();
        } else if (hasAuthModule() && window.WinixAuth.isValidId) {
            return window.WinixAuth.getUserIdFromAllSources?.() || null;
        }

        // Резервний варіант - зі сховища
        const storedId = getFromStorage('telegram_user_id');
        if (storedId && storedId !== 'undefined' && storedId !== 'null') {
            return storedId;
        }

        // З DOM
        const userIdElement = getElement('#user-id');
        if (userIdElement && userIdElement.textContent) {
            const id = userIdElement.textContent.trim();
            if (id && id !== 'undefined' && id !== 'null') {
                return id;
            }
        }

        // З URL
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            if (urlId) {
                return urlId;
            }
        } catch (e) {}

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
            const userIdElement = getElement('#user-id');
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

            // Оновлюємо дані користувача
            if (!_userData) _userData = {};

            _userData.balance = balanceData.balance || _userData.balance || 0;
            _userData.coins = balanceData.coins || _userData.coins || 0;

            // Зберігаємо в localStorage
            saveToStorage('userTokens', _userData.balance);
            saveToStorage('winix_balance', _userData.balance);
            saveToStorage('userCoins', _userData.coins);
            saveToStorage('winix_coins', _userData.coins);

            // Оновлюємо відображення
            updateBalanceDisplay();

            return {
                success: true,
                data: {
                    balance: _userData.balance,
                    coins: _userData.coins
                }
            };
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
                // Перевіряємо мінімальний інтервал
                if (Date.now() - _lastRequestTime >= MIN_REQUEST_INTERVAL) {
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

    // Обробник події підключення до мережі
    window.addEventListener('online', function() {
        console.log("🔄 Core: З'єднання з мережею відновлено");
        // Синхронізуємо дані
        syncUserData();
    });

    // Обробник події відключення від мережі
    window.addEventListener('offline', function() {
        console.warn("⚠️ Core: Втрачено з'єднання з мережею");
    });

    // ======== ПУБЛІЧНИЙ API ========

    // Експортуємо публічний API
    window.WinixCore = {
        // Версія модуля
        version: '1.1.0',

        // Утиліти
        getElement,
        saveToStorage,
        getFromStorage,
        formatCurrency,

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

    // Ініціалізуємо ядро при завантаженні сторінки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();