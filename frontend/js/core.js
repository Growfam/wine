/**
 * core.js - Базова функціональність WINIX
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
        // Якщо у нас вже є дані і не потрібно оновлювати
        if (_userData && !forceRefresh) {
            return _userData;
        }

        try {
            // Отримуємо дані з API
            const response = await window.WinixAPI.getUserData();

            if (response.status === 'success' && response.data) {
                _userData = response.data;

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

                // Повертаємо дані
                return _userData;
            } else {
                throw new Error(response.message || 'Не вдалося отримати дані користувача');
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
            _userData = {
                telegram_id: window.WinixAPI.getUserId() || 'unknown',
                balance: parseFloat(getFromStorage('userTokens', '0')),
                coins: parseInt(getFromStorage('userCoins', '0'))
            };

            return _userData;
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
            // Отримуємо дані користувача
            const userData = await getUserData(true);

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            // Генеруємо подію оновлення даних користувача
            document.dispatchEvent(new CustomEvent('user-data-updated', {
                detail: { userData }
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
        }

        // Запускаємо періодичну синхронізацію
        _refreshInterval = setInterval(async () => {
            try {
                await syncUserData();
            } catch (e) {
                console.warn('Помилка автоматичної синхронізації:', e);
            }
        }, interval);
    }

    /**
     * Зупинка періодичної синхронізації
     */
    function stopAutoSync() {
        if (_refreshInterval) {
            clearInterval(_refreshInterval);
            _refreshInterval = null;
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

            // Запускаємо автоматичну синхронізацію
            startAutoSync();

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
})();