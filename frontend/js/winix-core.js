/**
 * winix-core.js
 *
 * Основний модуль WINIX для ініціалізації та обслуговування базових функцій.
 * Забезпечує управління користувачем, відображення балансу та інші операції,
 * спільні для всього додатку.
 */

(function() {
    'use strict';

    // Перевіряємо наявність API модуля
    if (!window.WinixAPI) {
        console.error("❌ Помилка: Модуль WinixAPI не знайдено!");
        return;
    }

    console.log("🔄 Ініціалізація ядра WINIX...");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Прапорець для режиму відлагодження
    let _debugMode = false;

    // Дані користувача
    let _userData = null;

    // Прапорець для індикатора завантаження
    let _loaderVisible = false;

    // Черга запитів для запобігання блокуванню інтерфейсу
    let _requestQueue = [];
    let _isProcessingQueue = false;

    // Інтервал автоматичного оновлення даних
    let _refreshInterval = null;

    // ======== DOM ЕЛЕМЕНТИ ========

    const DOM = {
        // Елементи користувача
        userId: 'user-id',
        username: 'username',
        userAvatar: 'profile-avatar',

        // Елементи балансу
        userTokens: 'user-tokens',
        userCoins: 'user-coins',

        // Елементи навігації
        navItems: '.nav-item',

        // Елементи завантаження
        loader: 'loading-spinner'
    };

    // ======== УТИЛІТИ ========

    /**
     * Отримання елемента DOM
     * @param {string} selector - Селектор елемента
     * @param {boolean} multiple - Чи повертати колекцію елементів
     * @returns {HTMLElement|NodeList|null} Елемент DOM або null
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
     * @param {boolean} isObject - Чи потрібно парсити як об'єкт
     * @returns {any} Значення або значення за замовчуванням
     */
    function getFromStorage(key, defaultValue = null, isObject = false) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;

            if (isObject) {
                try {
                    return JSON.parse(value);
                } catch (e) {
                    console.warn(`Помилка парсингу JSON з localStorage: ${key}`, e);
                    return defaultValue;
                }
            }

            return value;
        } catch (e) {
            console.error(`Помилка отримання з localStorage: ${key}`, e);
            return defaultValue;
        }
    }

    /**
     * Форматування числа як грошової суми
     * @param {number} amount - Сума
     * @param {number} decimals - Кількість знаків після коми
     * @returns {string} Форматована сума
     */
    function formatCurrency(amount, decimals = 2) {
        try {
            return parseFloat(amount)
                .toFixed(decimals)
                .replace(/\d(?=(\d{3})+\.)/g, '$& ');
        } catch (e) {
            console.error('Помилка форматування суми:', e);
            return amount.toString();
        }
    }

    /**
     * Показати повідомлення користувачу
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип повідомлення ('success', 'error', 'info')
     * @param {Function} callback - Функція зворотного виклику
     */
    // Оновлена версія функції showNotification у winix-core.js
function showNotification(message, type = 'success', callback = null) {
    // Запобігаємо показу порожніх повідомлень
    if (!message || message.trim() === '') {
        console.warn("Спроба показати порожнє повідомлення");
        if (callback) setTimeout(callback, 100);
        return;
    }

    try {
        // Перевіряємо чи це не рекурсивний виклик
        if (window._isShowingNotification) {
            console.warn("Запобігання рекурсивному виклику showNotification");
            return;
        }

        window._isShowingNotification = true;

        // Спочатку перевіряємо наявність сучасних повідомлень
        if (typeof window.showModernNotification === 'function') {
            window._isShowingNotification = false;
            window.showModernNotification(message, type === 'error', callback);
            return;
        }

        // Інакше використовуємо інші доступні методи
        if (typeof window.showToast === 'function' && window.showToast !== window.showNotification) {
            window._isShowingNotification = false;
            window.showToast(message, type);
            if (callback) setTimeout(callback, 1500);
            return;
        }

        if (typeof window.simpleAlert === 'function') {
            window._isShowingNotification = false;
            window.simpleAlert(message, type === 'error', callback);
            return;
        }

        // ВАЖЛИВО: НЕ використовуємо window.showMessage тут, щоб уникнути рекурсії

        // Як останній варіант використовуємо стандартний alert
        alert(message);
        if (callback) callback();

        window._isShowingNotification = false;
    } catch (e) {
        window._isShowingNotification = false;
        console.error("Помилка при показі повідомлення:", e);
        alert(message);
        if (callback) callback();
    }
}
    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З КОРИСТУВАЧЕМ ========

    /**
     * Отримання даних користувача
     * @param {boolean} forceRefresh - Чи потрібно примусово оновити дані
     * @returns {Promise<Object>} Дані користувача
     */
    async function getUserData(forceRefresh = false) {
        try {
            // Якщо у нас вже є дані і не потрібно оновлювати
            if (_userData && !forceRefresh) {
                return _userData;
            }

            // Отримуємо дані з API
            const response = await window.WinixAPI.getUserData();

            if (response.status === 'success' && response.data) {
                _userData = response.data;

                // Зберігаємо дані в localStorage
                saveToStorage('userData', _userData);

                // Оновлюємо баланс в localStorage
                if (_userData.balance !== undefined) {
                    saveToStorage('userTokens', _userData.balance);
                    saveToStorage('winix_balance', _userData.balance);
                }

                if (_userData.coins !== undefined) {
                    saveToStorage('userCoins', _userData.coins);
                }

                return _userData;
            } else {
                throw new Error(response.message || 'Не вдалося отримати дані користувача');
            }
        } catch (error) {
            console.error('Помилка отримання даних користувача:', error);

            // Намагаємося отримати дані з localStorage
            const storedUserData = getFromStorage('userData', null, true);
            if (storedUserData) {
                _userData = storedUserData;
                return _userData;
            }

            throw error;
        }
    }

    /**
     * Оновлення відображення даних користувача
     */
    function updateUserDisplay() {
        try {
            // Оновлюємо ID користувача
            const userIdElement = getElement(`#${DOM.userId}`);
            if (userIdElement && _userData && _userData.telegram_id) {
                userIdElement.textContent = _userData.telegram_id;
            } else if (userIdElement) {
                const userId = window.WinixAPI.getUserId() || getFromStorage('telegram_user_id', 'Unknown ID');
                userIdElement.textContent = userId;
            }

            // Оновлюємо ім'я користувача
            const usernameElement = getElement(`#${DOM.username}`);
            if (usernameElement && _userData && _userData.username) {
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
            const avatarElement = getElement(`#${DOM.userAvatar}`);
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
                    // Якщо не вдалося завантажити зображення, показуємо першу літеру імені
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

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З БАЛАНСОМ ========

    /**
     * Отримання балансу користувача
     * @returns {number} Баланс у токенах
     */
    function getBalance() {
        try {
            return _userData?.balance || parseFloat(getFromStorage('userTokens', '0'));
        } catch (e) {
            console.error('Помилка отримання балансу:', e);
            return 0;
        }
    }

    /**
     * Отримання кількості жетонів користувача
     * @returns {number} Кількість жетонів
     */
    function getCoins() {
        try {
            return _userData?.coins || parseInt(getFromStorage('userCoins', '0'));
        } catch (e) {
            console.error('Помилка отримання кількості жетонів:', e);
            return 0;
        }
    }

    /**
     * Оновлення відображення балансу
     */
    function updateBalanceDisplay() {
        try {
            // Оновлюємо відображення токенів
            const tokensElement = getElement(`#${DOM.userTokens}`);
            if (tokensElement) {
                const balance = getBalance();
                tokensElement.textContent = formatCurrency(balance);
            }

            // Оновлюємо відображення жетонів
            const coinsElement = getElement(`#${DOM.userCoins}`);
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
     * @returns {Promise<Object>} Результат операції
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

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З НАВІГАЦІЄЮ ========

    /**
     * Ініціалізація навігаційних елементів
     */
    function initNavigation() {
        try {
            const navItems = getElement(DOM.navItems, true);
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

    // ======== ФУНКЦІЇ ДЛЯ УПРАВЛІННЯ ЗАВАНТАЖЕННЯМ ========

    /**
     * Показати індикатор завантаження
     * @param {string} message - Повідомлення під індикатором
     */
    // Виправлена функція showLoading в winix-core.js
function showLoading(message = 'Завантаження...') {
    try {
        // Запобігаємо повторному показу індикатора
        if (window._loaderVisible) {
            // Якщо індикатор вже показаний, просто оновлюємо повідомлення
            const loaderMessage = document.querySelector('#loading-spinner .message');
            if (loaderMessage) loaderMessage.textContent = message;
            return;
        }

        window._loaderVisible = true;

        // Створюємо індикатор, якщо його немає
        let loader = document.getElementById('loading-spinner');

        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'loading-spinner';
            loader.innerHTML = `
                <div class="spinner"></div>
                <div class="message">${message}</div>
            `;

            // Додаємо стилі
            loader.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            `;

            // Додаємо лічильник використань для відстеження повторних викликів
            loader.dataset.useCount = '1';

            document.body.appendChild(loader);
        } else {
            // Якщо індикатор вже існує, оновлюємо повідомлення і збільшуємо лічильник
            const useCount = parseInt(loader.dataset.useCount || '0') + 1;
            loader.dataset.useCount = useCount.toString();

            const loaderMessage = loader.querySelector('.message');
            if (loaderMessage) loaderMessage.textContent = message;

            // Показуємо індикатор
            loader.style.display = 'flex';
        }

        console.log("🔄 Показано індикатор завантаження");
    } catch (e) {
        console.error('Помилка показу індикатора завантаження:', e);
        window._loaderVisible = false;
    }
}

    /**
     * Приховати індикатор завантаження
     */
function hideLoading() {
    try {
        const loader = document.getElementById('loading-spinner');
        if (!loader) {
            window._loaderVisible = false;
            return;
        }

        // Зменшуємо лічильник використань
        let useCount = parseInt(loader.dataset.useCount || '1') - 1;

        // Якщо лічильник досяг нуля, приховуємо індикатор
        if (useCount <= 0) {
            loader.style.display = 'none';
            loader.dataset.useCount = '0';
            window._loaderVisible = false;
            console.log("✅ Приховано індикатор завантаження");
        } else {
            // Інакше просто оновлюємо лічильник
            loader.dataset.useCount = useCount.toString();
        }
    } catch (e) {
        console.error('Помилка приховування індикатора завантаження:', e);
        window._loaderVisible = false;
    }
}

    // ======== ФУНКЦІЇ ДЛЯ УПРАВЛІННЯ ЧЕРГОЮ ЗАПИТІВ ========

    /**
     * Додавання запиту до черги
     * @param {Function} request - Функція запиту
     * @returns {Promise} Результат виконання запиту
     */
    function enqueue(request) {
        return new Promise((resolve, reject) => {
            _requestQueue.push({
                request,
                resolve,
                reject
            });

            // Запускаємо обробку черги, якщо вона ще не запущена
            if (!_isProcessingQueue) {
                processQueue();
            }
        });
    }

    /**
     * Обробка черги запитів
     */
    async function processQueue() {
        if (_isProcessingQueue || _requestQueue.length === 0) {
            return;
        }

        _isProcessingQueue = true;

        try {
            // Отримуємо перший запит з черги
            const { request, resolve, reject } = _requestQueue.shift();

            // Виконуємо запит
            try {
                const result = await request();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        } catch (e) {
            console.error('Помилка обробки запиту в черзі:', e);
        } finally {
            _isProcessingQueue = false;

            // Якщо в черзі ще є запити, запускаємо їх обробку
            if (_requestQueue.length > 0) {
                setTimeout(processQueue, 50);
            }
        }
    }

    // ======== ФУНКЦІЇ СИНХРОНІЗАЦІЇ ДАНИХ ========

    /**
     * Синхронізація даних користувача з сервером
     * @returns {Promise<Object>} Результат синхронізації
     */
    async function syncUserData() {
        try {
            // Отримуємо дані користувача
            const userData = await getUserData(true);

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            // Викликаємо оновлення стейкінгу, якщо є такий модуль
            if (window.WinixStakingSystem && typeof window.WinixStakingSystem.refresh === 'function') {
                try {
                    await window.WinixStakingSystem.refresh();
                } catch (e) {
                    console.warn('Помилка оновлення даних стейкінгу:', e);
                }
            }

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
     * @param {number} interval - Інтервал в мілісекундах
     */
    function startAutoSync(interval = 300000) { // 5 хвилин за замовчуванням
        // Зупиняємо попередній інтервал, якщо він є
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

    // ======== ФУНКЦІЇ ІНІЦІАЛІЗАЦІЇ ========

    /**
     * Ініціалізація ядра WINIX
     */
    async function init() {
        try {
            // Отримуємо дані користувача
            await getUserData();

            // Оновлюємо відображення
            updateUserDisplay();
            updateBalanceDisplay();

            // Ініціалізуємо навігацію
            initNavigation();

            // Запускаємо автоматичну синхронізацію
            startAutoSync();

            // Створюємо глобальні функції для використання іншими модулями
            window.showLoading = showLoading;
            window.hideLoading = hideLoading;
            window.showToast = (message, type) => showNotification(message, type);

            console.log("✅ Ядро WINIX успішно ініціалізовано");

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
        // Конфігурація
        setDebugMode: (debug) => { _debugMode = debug; },

        // Функції для роботи з користувачем
        getUserData,
        updateUserDisplay,

        // Функції для роботи з балансом
        getBalance,
        getCoins,
        updateBalanceDisplay,
        refreshBalance,

        // Функції для управління завантаженням
        showLoading,
        hideLoading,

        // Функції для управління чергою запитів
        enqueue,

        // Функції для синхронізації даних
        syncUserData,
        startAutoSync,
        stopAutoSync,

        // Утиліти
        formatCurrency,
        showNotification,
        saveToStorage,
        getFromStorage
    };

    // Ініціалізуємо ядро при завантаженні сторінки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();