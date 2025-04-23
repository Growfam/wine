/**
 * core.js - Базова функціональність WINIX
 * Оптимізована версія з покращеною продуктивністю та стабільністю
 * @version 2.0.0
 */

(function() {
    'use strict';

    console.log("🔄 Core: Ініціалізація ядра WINIX");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Дані користувача
    let _userData = null;

    // Стан модуля
    const _state = {
        // Прапорець ініціалізації ядра
        initialized: false,

        // Інтервал автооновлення
        refreshInterval: null,

        // Блокування запитів
        requestInProgress: false,

        // Час останнього запиту
        lastRequestTime: 0,

        // Лічильник помилок
        errorCounter: 0,

        // Максимальна кількість помилок перед скиданням стану
        maxErrorsBeforeReset: 5,

        // Час останньої помилки
        lastErrorTime: 0,

        // Кеш запитів
        requestCache: {}
    };

    // Конфігурація
    const _config = {
        // Мінімальний інтервал між запитами (мс)
        minRequestInterval: 5000,

        // Час життя кешу даних користувача (мс)
        userCacheTtl: 300000, // 5 хвилин

        // Інтервал автооновлення (мс)
        autoRefreshInterval: 300000 // 5 хвилин
    };

    // ======== УТИЛІТИ ========

    /**
     * Отримання елемента DOM
     * @param {string} selector - Селектор елемента
     * @param {boolean} multiple - Отримати всі елементи
     * @returns {Element|NodeList|null} Елемент DOM
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
     * Зберігання даних в localStorage
     * @param {string} key - Ключ
     * @param {any} value - Значення
     * @returns {boolean} Результат збереження
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
            console.warn(`⚠️ Помилка збереження в localStorage: ${key}`, e);
            return false;
        }
    }

    /**
     * Отримання даних з localStorage
     * @param {string} key - Ключ
     * @param {any} defaultValue - Значення за замовчуванням
     * @param {boolean} isObject - Чи парсити як об'єкт
     * @returns {any} Значення з localStorage
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
     * @returns {string} Форматоване число
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
     * Перевірка наявності API модуля
     * @returns {boolean} Чи доступний API модуль
     */
    function hasApiModule() {
        try {
            return window.WinixAPI &&
                   typeof window.WinixAPI.apiRequest === 'function' &&
                   typeof window.WinixAPI.getUserId === 'function';
        } catch (e) {
            console.warn("⚠️ Помилка перевірки API модуля:", e);
            return false;
        }
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

            // Очищаємо локальне сховище з важливими виключеннями
            try {
                // Зберігаємо лише критичні дані для автентифікації
                const userId = getFromStorage('telegram_user_id');
                const authToken = getFromStorage('auth_token');

                // Перезаписуємо критичні дані після очищення
                if (userId) saveToStorage('telegram_user_id', userId);
                if (authToken) saveToStorage('auth_token', authToken);
            } catch (e) {
                console.warn("⚠️ Помилка очищення localStorage:", e);
            }

            // Скидаємо стан WinixRaffles, якщо він існує
            if (window.WinixRaffles && typeof window.WinixRaffles.resetState === 'function') {
                window.WinixRaffles.resetState();
            }

            // Показуємо повідомлення користувачу
            if (typeof window.showToast === 'function') {
                window.showToast('Виконується перезавантаження додатку...', 'info');
            }

            // Перезавантажуємо сторінку з невеликою затримкою
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
     * @returns {Promise<Object>} Дані користувача
     */
    async function getUserData(forceRefresh = false) {
        // Перевіряємо, чи пристрій онлайн
        if (!isOnline() && !forceRefresh) {
            console.warn("⚠️ Core: Пристрій офлайн, використовуємо кешовані дані");

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

        // Перевіряємо частоту запитів і наявність кешу
        const now = Date.now();
        if (!forceRefresh && (now - _state.lastRequestTime < _config.minRequestInterval)) {
            console.log("⏳ Core: Занадто частий запит даних користувача, використовуємо кеш");

            // Якщо у нас вже є дані і не потрібно оновлювати
            if (_userData) {
                return _userData;
            }

            // Намагаємося завантажити з localStorage
            const storedData = getFromStorage('userData', null, true);
            if (storedData) {
                _userData = storedData;
                return _userData;
            }
        }

        // Запобігаємо паралельним запитам
        if (_state.requestInProgress && !forceRefresh) {
            console.log("⏳ Core: Запит даних користувача вже виконується");

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

        // Оновлюємо час останнього запиту і встановлюємо блокування
        _state.lastRequestTime = now;
        _state.requestInProgress = true;

        try {
            // Використовуємо API для отримання даних користувача
            if (hasApiModule()) {
                // Формуємо запит
                const userId = getUserId();
                if (!userId) {
                    throw new Error('ID користувача не знайдено');
                }

                // Додаємо параметр запобігання кешування
                const endpoint = `user/${userId}/info?t=${now}`;

                // Відправляємо запит
                const response = await window.WinixAPI.apiRequest(endpoint, 'GET', null, {
                    suppressErrors: true,
                    timeout: 10000
                });

                _state.requestInProgress = false;

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

                    // Оновлюємо час кешування
                    saveToStorage('userData_timestamp', now.toString());

                    // Генеруємо подію оновлення
                    document.dispatchEvent(new CustomEvent('user-data-updated', {
                        detail: { userData: _userData },
                        source: 'core.js'
                    }));

                    // Скидаємо лічильник помилок при успішному запиті
                    _state.errorCounter = 0;

                    return _userData;
                } else {
                    throw new Error(response?.message || 'Не вдалося отримати дані користувача');
                }
            } else {
                // Якщо WinixAPI недоступний, використовуємо запасний метод
                _state.requestInProgress = false;

                // Використовуємо дані з localStorage
                const storedUserData = getFromStorage('userData', null, true);
                if (storedUserData) {
                    _userData = storedUserData;
                    return _userData;
                }

                console.warn('⚠️ Core: API модуль недоступний');

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
            console.error('❌ Помилка отримання даних користувача:', error);
            _state.requestInProgress = false;

            // Збільшуємо лічильник помилок
            _state.errorCounter++;
            _state.lastErrorTime = now;

            // Перевірка на критичну кількість помилок
            if (_state.errorCounter >= _state.maxErrorsBeforeReset) {
                console.warn(`⚠️ Core: Досягнуто критичної кількості помилок (${_state.errorCounter}), скидання стану...`);

                if (typeof window.showToast === 'function') {
                    window.showToast('Виникли проблеми з`єднання. Спроба відновлення...', 'warning');
                }

                // Скидаємо лічильник помилок
                _state.errorCounter = 0;

                // Запускаємо скидання стану
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
        // Перевіряємо різні джерела ID користувача в порядку пріоритету

        // 1. З API модуля
        if (hasApiModule()) {
            try {
                const apiId = window.WinixAPI.getUserId();
                if (apiId && apiId !== 'undefined' && apiId !== 'null') {
                    return apiId;
                }
            } catch (e) {
                console.warn("⚠️ Core: Помилка отримання ID через API:", e);
            }
        }

        // 2. З localStorage
        try {
            const storedId = getFromStorage('telegram_user_id');
            if (storedId && storedId !== 'undefined' && storedId !== 'null') {
                return storedId;
            }
        } catch (e) {
            console.warn("⚠️ Core: Помилка отримання ID зі сховища:", e);
        }

        // 3. З DOM
        try {
            // Спочатку перевіряємо елемент в хедері
            const headerUserIdElement = getElement('#header-user-id');
            if (headerUserIdElement && headerUserIdElement.textContent) {
                const id = headerUserIdElement.textContent.trim();
                if (id && id !== 'undefined' && id !== 'null') {
                    saveToStorage('telegram_user_id', id);
                    return id;
                }
            }

            // Потім перевіряємо прихований елемент
            const userIdElement = getElement('#user-id');
            if (userIdElement && userIdElement.textContent) {
                const id = userIdElement.textContent.trim();
                if (id && id !== 'undefined' && id !== 'null') {
                    saveToStorage('telegram_user_id', id);
                    return id;
                }
            }
        } catch (e) {
            console.warn("⚠️ Core: Помилка отримання ID з DOM:", e);
        }

        // 4. З URL
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            if (urlId && urlId !== 'undefined' && urlId !== 'null') {
                saveToStorage('telegram_user_id', urlId);
                return urlId;
            }
        } catch (e) {
            console.warn("⚠️ Core: Помилка отримання ID з URL:", e);
        }

        // 5. З Telegram WebApp
        try {
            if (window.Telegram && window.Telegram.WebApp &&
                window.Telegram.WebApp.initDataUnsafe &&
                window.Telegram.WebApp.initDataUnsafe.user &&
                window.Telegram.WebApp.initDataUnsafe.user.id) {

                const telegramId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
                if (telegramId) {
                    saveToStorage('telegram_user_id', telegramId);
                    return telegramId;
                }
            }
        } catch (e) {
            console.warn("⚠️ Core: Помилка отримання ID з Telegram WebApp:", e);
        }

        return null;
    }

    /**
     * Оновлення відображення користувача
     */
    function updateUserDisplay() {
        try {
            // Отримуємо дані користувача
            const userData = _userData || {};
            const userId = userData.telegram_id || getUserId() || getFromStorage('telegram_user_id', 'Unknown ID');
            const username = userData.username || getFromStorage('username', 'User');

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
     * @param {string} username - Ім'я користувача
     */
    function updateUserAvatar(username) {
        try {
            const avatarElement = getElement('#profile-avatar');
            if (!avatarElement) return;

            // Очищаємо вміст аватара тільки якщо потрібні зміни
            username = username || _userData?.username || getFromStorage('username', 'User');
            const avatarSrc = getFromStorage('userAvatarSrc') || getFromStorage('avatarSrc');

            // Перевіряємо, чи потрібно оновлювати аватар
            if (avatarSrc) {
                // Якщо є зображення
                if (!avatarElement.querySelector('img')) {
                    avatarElement.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = avatarSrc;
                    img.alt = username;
                    img.onerror = () => {
                        avatarElement.textContent = username[0].toUpperCase();
                    };
                    avatarElement.appendChild(img);
                }
            } else if (avatarElement.textContent !== username[0].toUpperCase()) {
                // Якщо немає зображення, показуємо першу літеру
                avatarElement.innerHTML = '';
                avatarElement.textContent = username[0].toUpperCase();
            }
        } catch (e) {
            console.warn('⚠️ Помилка оновлення аватара:', e);
        }
    }

    /**
     * Отримання балансу користувача
     * @returns {number} Баланс користувача
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
     * @returns {number} Кількість жетонів
     */
    function getCoins() {
        try {
            // 1. Перевіряємо глобальний контролер синхронізації (найвищий пріоритет)
            if (window.__winixSyncControl && window.__winixSyncControl.lastValidBalance !== null) {
                return window.__winixSyncControl.lastValidBalance;
            }

            // 2. Перевіряємо дані користувача
            if (_userData?.coins !== undefined) {
                return _userData.coins;
            }

            // 3. Перевіряємо локальне сховище
            const storedCoins = parseInt(getFromStorage('userCoins', '0')) || parseInt(getFromStorage('winix_coins', '0'));
            if (storedCoins) {
                return storedCoins;
            }

            return 0;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Оновлення відображення балансу
     * @param {boolean} animate - Використовувати анімацію
     */
    function updateBalanceDisplay(animate = false) {
        try {
            // Оновлюємо відображення токенів
            const tokensElement = getElement('#user-tokens');
            if (tokensElement) {
                const balance = getBalance();
                const formattedBalance = formatCurrency(balance);

                // Оновлюємо тільки якщо змінилося
                if (tokensElement.textContent !== formattedBalance) {
                    tokensElement.textContent = formattedBalance;
                }
            }

            // Оновлюємо відображення жетонів
            const coinsElement = getElement('#user-coins');
            if (coinsElement) {
                const coins = getCoins();
                const currentCoins = parseInt(coinsElement.textContent) || 0;

                // Оновлюємо тільки якщо змінилося
                if (currentCoins !== coins) {
                    // Додаємо анімацію, якщо потрібно
                    if (animate) {
                        coinsElement.classList.remove('decreasing', 'increasing');

                        if (coins < currentCoins) {
                            coinsElement.classList.add('decreasing');
                        } else if (coins > currentCoins) {
                            coinsElement.classList.add('increasing');
                        }

                        // Видаляємо класи анімації через 1 секунду
                        setTimeout(() => {
                            coinsElement.classList.remove('decreasing', 'increasing');
                        }, 1000);
                    }

                    coinsElement.textContent = coins;
                }
            }
        } catch (e) {
            console.warn('⚠️ Помилка оновлення відображення балансу:', e);
        }
    }

    /**
     * Оновлення локального балансу з налаштуваннями анімації
     * @param {number} newBalance - Нове значення балансу
     * @param {string} source - Джерело зміни
     * @param {boolean} animate - Чи використовувати анімацію
     * @returns {boolean} Успішність оновлення
     */
    function updateLocalBalance(newBalance, source = 'unknown', animate = true) {
        if (typeof newBalance !== 'number' || isNaN(newBalance) || newBalance < 0) {
            console.warn('⚠️ Спроба встановити некоректний баланс:', newBalance);
            return false;
        }

        try {
            // Отримуємо поточне значення для порівняння
            const coinsElement = getElement('#user-coins');
            if (!coinsElement) return false;

            const oldBalance = parseInt(coinsElement.textContent) || 0;

            // Уникаємо непотрібних оновлень DOM
            if (oldBalance === newBalance) return true;

            // Видаляємо попередні класи анімації
            coinsElement.classList.remove('increasing', 'decreasing', 'updated');

            // Додаємо клас анімації, якщо потрібно
            if (animate) {
                if (newBalance > oldBalance) {
                    coinsElement.classList.add('increasing');
                } else if (newBalance < oldBalance) {
                    coinsElement.classList.add('decreasing');
                }
            }

            // Встановлюємо нове значення
            coinsElement.textContent = newBalance;

            // Оновлюємо дані користувача
            if (_userData) {
                _userData.coins = newBalance;
            }

            // Оновлюємо локальне сховище
            saveToStorage('userCoins', newBalance.toString());
            saveToStorage('winix_coins', newBalance.toString());
            saveToStorage('winix_balance_update_time', Date.now().toString());

            // Генеруємо стандартну подію про оновлення балансу
            document.dispatchEvent(new CustomEvent('balance-updated', {
                detail: {
                    oldBalance: oldBalance,
                    newBalance: newBalance,
                    source: source || 'core.js',
                    timestamp: Date.now()
                }
            }));

            // Видаляємо класи анімації після 1 секунди
            if (animate) {
                setTimeout(() => {
                    coinsElement.classList.remove('increasing', 'decreasing', 'updated');
                }, 1000);
            }

            return true;
        } catch (e) {
            console.warn('⚠️ Помилка оновлення локального балансу:', e);
            return false;
        }
    }

    /**
     * Оновлення балансу з сервера
     * @param {boolean} forceRefresh - Примусове оновлення
     * @returns {Promise<Object>} Результат оновлення
     */
    async function refreshBalance(forceRefresh = false) {
        // Створюємо інформацію про транзакцію для відстеження
        const transactionInfo = {
            id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 8),
            timestamp: Date.now(),
            source: 'core.js'
        };

        console.log(`🔄 Core: Запит оновлення балансу (ID: ${transactionInfo.id})`);

        // Перевіряємо, чи пристрій онлайн
        if (!isOnline() && !forceRefresh) {
            console.warn("⚠️ Core: Пристрій офлайн, використовуємо локальні дані балансу");

            // Явно отримуємо та обчислюємо всі дані для офлайн-режиму
            const lastKnownBalance = getCoins();
            const lastUpdateTime = parseInt(getFromStorage('winix_balance_update_time') || '0');
            const now = Date.now();
            const dataAge = now - lastUpdateTime;

            // Визначаємо статус даних для інформування
            let dataStatus = 'fresh';
            if (lastUpdateTime === 0) {
                dataStatus = 'unknown';
            } else if (dataAge > 30 * 60 * 1000) { // старше 30 хвилин
                dataStatus = 'stale';
            }

            // Оновлюємо відображення з локальних даних без анімації
            updateBalanceDisplay(false);

            return {
                success: true,
                offline: true,
                dataStatus: dataStatus,
                dataAge: dataAge,
                transactionId: transactionInfo.id,
                data: {
                    coins: lastKnownBalance,
                    lastUpdate: lastUpdateTime
                }
            };
        }

        // Перевіряємо блокування через глобальний контролер
        if (window.__winixSyncControl &&
            window.__winixSyncControl.isBlocked &&
            window.__winixSyncControl.isBlocked('core_balance') &&
            !forceRefresh) {

            console.log("🔒 Core: Оновлення балансу заблоковано контролером синхронізації");

            // Використовуємо останній валідний баланс з контролера
            if (window.__winixSyncControl.lastValidBalance !== null) {
                // Оновлюємо відображення без анімації
                updateLocalBalance(window.__winixSyncControl.lastValidBalance, 'sync_control', false);

                return {
                    success: true,
                    blocked: true,
                    source: 'sync_control',
                    data: {
                        coins: window.__winixSyncControl.lastValidBalance
                    }
                };
            }
        }

        // Перевірка на частоту запитів
        if (!forceRefresh && (Date.now() - _state.lastRequestTime < _config.minRequestInterval)) {
            console.log("⏳ Core: Занадто частий запит балансу, використовуємо кеш");
            return {
                success: true,
                cached: true,
                data: {
                    coins: getCoins(),
                    cached: true
                }
            };
        }

        // Блокуємо паралельні запити
        if (_state.requestInProgress && !forceRefresh) {
            console.log("⏳ Core: Запит балансу вже виконується");
            return {
                success: true,
                inProgress: true,
                data: {
                    coins: getCoins(),
                    inProgress: true
                }
            };
        }

        // Оновлюємо час останнього запиту і встановлюємо блокування
        _state.lastRequestTime = Date.now();
        _state.requestInProgress = true;

        // Зберігаємо поточний баланс для порівняння
        const oldBalance = getCoins();
        transactionInfo.oldBalance = oldBalance;

        try {
            // Отримання балансу через API
            if (hasApiModule()) {
                // Отримуємо ID користувача
                const userId = getUserId();
                if (!userId) {
                    throw new Error('ID користувача не знайдено');
                }

                // Додаємо параметр запобігання кешування
                const endpoint = `user/${userId}/balance?t=${Date.now()}`;

                // Відправляємо запит
                const response = await window.WinixAPI.apiRequest(endpoint, 'GET', null, {
                    suppressErrors: true,
                    timeout: 10000
                });

                // Завершуємо запит
                _state.requestInProgress = false;

                if (response && response.status === 'success' && response.data) {
                    // Отримуємо новий баланс з відповіді
                    const newBalance = response.data.coins !== undefined ? response.data.coins : oldBalance;
                    transactionInfo.newBalance = newBalance;
                    transactionInfo.serverResponse = true;

                    // Перевіряємо наявність глобального контролера синхронізації
                    if (window.__winixSyncControl) {
                        // Зберігаємо останній валідний баланс
                        window.__winixSyncControl.lastValidBalance = newBalance;
                    }

                    // Оновлюємо відображення з анімацією
                    updateLocalBalance(newBalance, 'core.js', true);

                    // Оновлюємо дані користувача
                    if (_userData) {
                        _userData.coins = newBalance;
                    }

                    // Оновлюємо кеш
                    saveToStorage('userCoins', newBalance.toString());
                    saveToStorage('winix_coins', newBalance.toString());
                    saveToStorage('winix_balance_update_time', Date.now().toString());

                    // Записуємо інформацію про транзакцію
                    saveToStorage('winix_last_balance_transaction', JSON.stringify(transactionInfo));

                    // Скидаємо лічильник помилок
                    _state.errorCounter = 0;

                    return {
                        success: true,
                        transactionId: transactionInfo.id,
                        data: {
                            coins: newBalance,
                            oldCoins: oldBalance
                        }
                    };
                } else {
                    throw new Error(response?.message || 'Не вдалося отримати баланс');
                }
            } else {
                // Альтернативна логіка, якщо API недоступне
                _state.requestInProgress = false;

                // Отримуємо баланс з localStorage
                const storedCoins = getCoins();

                return {
                    success: true,
                    fallback: true,
                    transactionId: transactionInfo.id,
                    data: {
                        coins: storedCoins,
                        fallback: true
                    }
                };
            }
        } catch (error) {
            console.error('❌ Core: Помилка оновлення балансу:', error);
            _state.requestInProgress = false;

            // Збільшуємо лічильник помилок
            _state.errorCounter++;
            _state.lastErrorTime = Date.now();

            // Перевірка на критичну кількість помилок
            if (_state.errorCounter >= _state.maxErrorsBeforeReset) {
                console.warn(`⚠️ Core: Досягнуто критичної кількості помилок (${_state.errorCounter}), скидання стану...`);

                if (typeof window.showToast === 'function') {
                    window.showToast('Виникли проблеми з`єднання. Спроба відновлення...', 'warning');
                }

                // Скидаємо лічильник помилок
                _state.errorCounter = 0;

                // Запускаємо скидання стану
                setTimeout(resetAndReloadApplication, 1000);
            }

            // Повертаємо останній відомий баланс
            return {
                success: false,
                message: error.message || 'Не вдалося оновити баланс',
                transactionId: transactionInfo.id,
                data: {
                    coins: oldBalance,
                    error: true
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

                // Додаємо обробник кліку, якщо його ще немає
                if (!item.hasAttribute('data-initialized')) {
                    item.setAttribute('data-initialized', 'true');

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
                }
            });
        } catch (e) {
            console.warn('⚠️ Помилка ініціалізації навігації:', e);
        }
    }

    // ======== СИНХРОНІЗАЦІЯ ДАНИХ ========

    /**
     * Синхронізація даних користувача з сервером
     * @param {boolean} forceRefresh - Примусова синхронізація
     * @returns {Promise<Object>} Результат синхронізації
     */
    async function syncUserData(forceRefresh = false) {
        try {
            console.log('🔄 Core: Початок синхронізації даних користувача...');

            // Перевіряємо, чи пристрій онлайн
            if (!isOnline() && !forceRefresh) {
                console.warn("⚠️ Core: Пристрій офлайн, використовуємо локальні дані");

                // Отримуємо останні відомі дані
                const lastKnownBalance = getCoins();
                const lastUpdateTime = parseInt(getFromStorage('winix_balance_update_time') || '0');
                const now = Date.now();

                // Перевіряємо актуальність даних
                const dataAge = now - lastUpdateTime;
                let dataStatus = 'fresh';

                if (lastUpdateTime === 0) {
                    dataStatus = 'unknown';
                } else if (dataAge > 30 * 60 * 1000) { // старше 30 хвилин
                    dataStatus = 'stale';
                }

                // Оновлюємо відображення
                updateUserDisplay();
                updateBalanceDisplay();

                // Показуємо статус, якщо дані застарілі
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
                        lastUpdate: lastUpdateTime
                    }
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
        if (_state.refreshInterval) {
            clearInterval(_state.refreshInterval);
            _state.refreshInterval = null;
        }

        // Запускаємо періодичну синхронізацію
        _state.refreshInterval = setInterval(async () => {
            try {
                // Перевіряємо, чи пристрій онлайн
                if (!isOnline()) {
                    console.warn("⚠️ Core: Пристрій офлайн, пропускаємо синхронізацію");
                    return;
                }

                // Перевіряємо мінімальний інтервал і запит в прогресі
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

    // ======== БЛОКУВАННЯ ОНОВЛЕНЬ БАЛАНСУ ========

    /**
     * Блокування оновлень балансу на вказаний час
     * @param {number} duration - Тривалість блокування в мс
     * @param {Object} options - Опції блокування
     * @returns {boolean} Результат блокування
     */
    function lockBalanceUpdates(duration, options = {}) {
        // Якщо є контролер синхронізації, використовуємо його
        if (window.__winixSyncControl && typeof window.__winixSyncControl.block === 'function') {
            return window.__winixSyncControl.block(duration / 1000, {
                type: options.type || 'core_balance',
                reason: options.reason || 'manual_lock',
                source: 'core.js'
            });
        }

        return false;
    }

    /**
     * Перевірка, чи заблоковані оновлення балансу
     * @param {string} source - Джерело запиту
     * @param {string} type - Тип запиту
     * @returns {boolean} Стан блокування
     */
    function isBalanceUpdateLocked(source, type = 'general') {
        // Якщо є контролер синхронізації, використовуємо його
        if (window.__winixSyncControl && typeof window.__winixSyncControl.isBlocked === 'function') {
            return window.__winixSyncControl.isBlocked(source, type);
        }

        return false;
    }

    // ======== УТИЛІТИ ДЛЯ ІНШИХ МОДУЛІВ ========

    /**
     * Перевірка частоти запитів до API
     * @param {string} key - Ключ для ідентифікації типу запиту
     * @param {number} interval - Мінімальний інтервал між запитами (мс)
     * @returns {boolean} true, якщо запит можна виконати, false - якщо потрібно почекати
     */
    function checkRequestThrottle(key, interval = 5000) {
        const now = Date.now();
        const lastRequest = _state.requestCache[key] || 0;

        if (now - lastRequest < interval) {
            return false;
        }

        _state.requestCache[key] = now;
        return true;
    }

    /**
     * Очищення кешу запитів
     * @param {string} key - Ключ для очищення (якщо не вказано, очищається весь кеш)
     */
    function clearRequestCache(key) {
        if (key) {
            delete _state.requestCache[key];
        } else {
            _state.requestCache = {};
        }
    }

    // ======== ІНІЦІАЛІЗАЦІЯ ========

    /**
     * Ініціалізація ядра WINIX
     * @returns {Promise<boolean>} Результат ініціалізації
     */
    async function init() {
        try {
            // Перевіряємо чи вже ініціалізовано ядро
            if (_state.initialized) {
                console.log("✅ Core: Ядро WINIX вже ініціалізоване");
                return true;
            }

            console.log("🔄 Core: Початок ініціалізації ядра WINIX");

            // Ініціалізуємо Telegram WebApp, якщо він доступний
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

            // У випадку помилки використовуємо кешовані дані
            updateUserDisplay();
            updateBalanceDisplay();

            document.dispatchEvent(new CustomEvent('winix-initialization-error', { detail: error }));

            return false;
        }
    }

    /**
     * Перевірка, чи ядро ініціалізовано
     * @returns {boolean} Стан ініціалізації
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

            // Оновлюємо дані користувача
            if (!_userData) _userData = {};

            if (event.detail.newBalance !== undefined) {
                _userData.coins = event.detail.newBalance;
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
                console.log("✅ Core: Дані успішно синхронізовано після відновлення з'єднання");
            }).catch(error => {
                console.warn("⚠️ Core: Помилка синхронізації після відновлення з'єднання:", error);
            });
        }, 1000);
    });

    // Обробник події відключення від мережі
    window.addEventListener('offline', function() {
        console.warn("⚠️ Core: Втрачено з'єднання з мережею");
    });

    // Обробник події завантаження сторінки
    window.addEventListener('load', function() {
        // Запобігаємо частій ініціалізації
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

    // Експортуємо публічний API
    window.WinixCore = {
        // Метадані
        version: '2.0.0',
        isInitialized: isInitialized,

        // Утиліти
        getElement,
        saveToStorage,
        getFromStorage,
        formatCurrency,
        isOnline,
        resetAndReloadApplication,
        checkRequestThrottle,
        clearRequestCache,

        // Функції користувача
        getUserData,
        getUserId,
        updateUserDisplay,
        getBalance,
        getCoins,
        updateBalanceDisplay,
        updateLocalBalance,
        refreshBalance,
        lockBalanceUpdates,
        isBalanceUpdateLocked,

        // Функції для синхронізації даних
        syncUserData,
        startAutoSync,
        stopAutoSync,

        // Ініціалізація
        init
    };

    // Додаємо функцію resetAndReloadApplication в глобальний простір імен
    window.resetAndReloadApplication = resetAndReloadApplication;

    console.log("✅ Core: Модуль успішно завантажено");
})();