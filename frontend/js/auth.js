/**
 * auth.js - Модуль авторизації для Telegram Mini App
 * Версія без заглушок - тільки реальні дані з бекенду
 * @version 2.0.0
 */

(function() {
    'use strict';

    console.log("🔐 AUTH: Ініціалізація системи авторизації");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Флаги для контролю запитів
    let _authRequestInProgress = false;
    let _userDataRequestInProgress = false;
    let _lastRequestTime = 0;

    // Мінімальний інтервал між запитами (30 секунд)
    const MIN_REQUEST_INTERVAL = 30000;

    // Підтримка подій
    const EVENT_USER_DATA_UPDATED = 'user-data-updated';
    const EVENT_AUTH_SUCCESS = 'auth-success';
    const EVENT_AUTH_ERROR = 'auth-error';
    const EVENT_ACCESS_DENIED = 'access-denied';

    // Для періодичного оновлення
    let _periodicUpdateInterval = null;

    // Поточна мова інтерфейсу
    let _currentLang = 'uk';

    // Тексти повідомлень
    const MESSAGES = {
        uk: {
            authError: "Помилка авторизації. Спробуйте перезапустити додаток.",
            dataError: "Помилка отримання даних користувача.",
            welcome: "Вітаємо у WINIX!",
            noTelegramId: "Додаток доступний тільки через Telegram",
            accessDenied: "Доступ заборонено. Відкрийте додаток через Telegram."
        },
        ru: {
            authError: "Ошибка авторизации. Попробуйте перезапустить приложение.",
            dataError: "Ошибка получения данных пользователя.",
            welcome: "Добро пожаловать в WINIX!",
            noTelegramId: "Приложение доступно только через Telegram",
            accessDenied: "Доступ запрещен. Откройте приложение через Telegram."
        },
        en: {
            authError: "Authorization error. Try restarting the app.",
            dataError: "Error retrieving user data.",
            welcome: "Welcome to WINIX!",
            noTelegramId: "App is only available through Telegram",
            accessDenied: "Access denied. Open the app through Telegram."
        }
    };

    // ======== TELEGRAM WEBAPP ІНІЦІАЛІЗАЦІЯ ========

    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        console.log("🔐 AUTH: Telegram WebApp ініціалізовано");
    }

    // ======== ДОПОМІЖНІ ФУНКЦІЇ ========

    /**
     * Перевірка валідності ID
     * @param {any} id - ID для перевірки
     * @returns {boolean} - Чи валідний ID
     */
    function isValidId(id) {
        return id &&
               id !== 'undefined' &&
               id !== 'null' &&
               id !== undefined &&
               id !== null &&
               typeof id !== 'function' &&
               id.toString().trim() !== '' &&
               !id.toString().includes('function') &&
               !id.toString().includes('=>') &&
               /^\d+$/.test(id.toString()); // Тільки цифри
    }

    /**
     * Блокування доступу до додатку
     */
    function blockAccess() {
        console.error("❌ AUTH: Доступ заблоковано - немає валідного Telegram ID");

        // Генеруємо подію про блокування доступу
        document.dispatchEvent(new CustomEvent(EVENT_ACCESS_DENIED));

        // Показуємо повідомлення
        const message = getLocalizedText('accessDenied');
        showError(message);

        // Приховуємо контент сторінки
        if (document.body) {
            document.body.style.display = 'none';
        }

        // Створюємо екран блокування
        const blockScreen = document.createElement('div');
        blockScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #1a1a1a;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 18px;
            z-index: 999999;
        `;
        blockScreen.innerHTML = `
            <div>
                <h2>${getLocalizedText('noTelegramId')}</h2>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(blockScreen);
    }

    /**
     * Отримання локалізований текст за поточною мовою
     * @param {string} key - Ключ повідомлення
     * @returns {string} - Локалізований текст
     */
    function getLocalizedText(key) {
        let currentLang = _currentLang;

        if (window.WinixLanguage && window.WinixLanguage.currentLang) {
            currentLang = window.WinixLanguage.currentLang;
        }

        if (MESSAGES[currentLang] && MESSAGES[currentLang][key]) {
            return MESSAGES[currentLang][key];
        }

        return MESSAGES.uk[key];
    }

    /**
     * Показати повідомлення про помилку
     * @param {string} message - Текст повідомлення
     */
    function showError(message) {
        console.error("❌ AUTH: " + message);

        if (window.simpleAlert) {
            window.simpleAlert(message, true);
            return;
        }

        if (window.showToast) {
            window.showToast(message, true);
            return;
        }

        alert(message);
    }

    /**
     * Показати вітальне повідомлення
     */
    function showWelcomeMessage() {
        console.log("🔐 AUTH: Показ вітального повідомлення");
        const message = getLocalizedText('welcome');

        if (window.simpleAlert) {
            window.simpleAlert(message, false);
            return;
        }

        if (window.showToast) {
            window.showToast(message);
            return;
        }

        alert(message);
    }

    // ======== ФУНКЦІЇ АВТОРИЗАЦІЇ ========

    /**
     * Отримати ID користувача ТІЛЬКИ з Telegram WebApp
     * @returns {string|null} ID користувача або null
     */
    function getTelegramUserId() {
        try {
            // ТІЛЬКИ Telegram WebApp як джерело ID
            if (window.Telegram &&
                window.Telegram.WebApp &&
                window.Telegram.WebApp.initDataUnsafe &&
                window.Telegram.WebApp.initDataUnsafe.user &&
                window.Telegram.WebApp.initDataUnsafe.user.id) {

                const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();

                if (isValidId(tgUserId)) {
                    return tgUserId;
                }
            }

            return null;
        } catch (e) {
            console.error("🔐 AUTH: Помилка отримання ID з Telegram WebApp:", e);
            return null;
        }
    }

    /**
     * Перевірка наявності API модуля
     * @returns {boolean} Чи доступний API модуль
     */
    function hasApiModule() {
        try {
            return window.WinixAPI &&
                   typeof window.WinixAPI.apiRequest === 'function';
        } catch (e) {
            console.error("🔐 AUTH: Помилка перевірки API модуля:", e);
            return false;
        }
    }

    /**
     * Ініціалізація системи авторизації
     * @returns {Promise<Object>} Об'єкт з даними користувача
     */
    async function init() {
    console.log("🔐 AUTH: Запуск ініціалізації");

    const now = Date.now();
    if ((now - _lastRequestTime) < MIN_REQUEST_INTERVAL) {
        console.log("🔐 AUTH: Часті виклики init, ігноруємо");
        if (window.WinixAuth.currentUser) {
            return Promise.resolve(window.WinixAuth.currentUser);
        }
        return Promise.resolve({});
    }

    _lastRequestTime = now;

    // Перевіряємо Telegram ID
    const telegramId = getTelegramUserId();
    if (!telegramId) {
        blockAccess();
        return Promise.reject(new Error('No Telegram ID'));
    }

    // Перевіряємо наявність API модуля
    if (!hasApiModule()) {
        console.error("⚠️ AUTH: API модуль недоступний");
        showError(getLocalizedText('authError'));
        return Promise.reject(new Error('API module not available'));
    }

 try {
    // Готуємо дані для авторизації
    const authData = {
        id: telegramId,
        telegram_id: telegramId
    };

    // КРИТИЧНО: Додаємо initData ОДРАЗУ при створенні authData
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
        authData.initData = window.Telegram.WebApp.initData;
        console.log("✅ AUTH: initData додано до authData (довжина: " + authData.initData.length + ")");
    } else {
        console.error("❌ AUTH: Telegram WebApp initData ВІДСУТНІЙ!");
        throw new Error("Додаток повинен бути відкритий через Telegram");
    }

        // ВАЖЛИВО: Додаємо дані від Telegram
        if (window.Telegram && window.Telegram.WebApp) {
            const tgWebApp = window.Telegram.WebApp;

            // Додаємо initData для перевірки підпису
            if (tgWebApp.initData) {
                authData.initData = tgWebApp.initData;
            }

            // Додаємо дані користувача
            if (tgWebApp.initDataUnsafe && tgWebApp.initDataUnsafe.user) {
                const tgUser = tgWebApp.initDataUnsafe.user;
                authData.username = tgUser.username;
                authData.first_name = tgUser.first_name;
                authData.last_name = tgUser.last_name;
                authData.language_code = tgUser.language_code;
            }
        }

        // Авторизуємо користувача
        return await authorizeUser(authData);
    } catch (error) {
        console.error("❌ AUTH: Помилка ініціалізації:", error);
        showError(getLocalizedText('authError'));
        return Promise.reject(error);
    }
}
    /**
     * Авторизація користувача на сервері
     * @param {Object} userData - Дані користувача з Telegram
     * @returns {Promise<Object>} Об'єкт з даними користувача
     */
async function authorizeUser(userData) {
    if (_authRequestInProgress) {
        console.log("🔐 AUTH: Авторизація вже виконується");
        return Promise.reject(new Error("Authorization already in progress"));
    }

    _authRequestInProgress = true;

    try {
        // Отримуємо Telegram ID
        const telegramId = getTelegramUserId();
        if (!telegramId) {
            blockAccess();
            throw new Error("No Telegram ID");
        }

        // КРИТИЧНО: Переконуємось що Telegram WebApp доступний
        if (!window.Telegram || !window.Telegram.WebApp) {
            throw new Error("Telegram WebApp не доступний");
        }

        const tgWebApp = window.Telegram.WebApp;

        // ВАЖЛИВО: Перевіряємо наявність initData
        if (!tgWebApp.initData) {
            console.error("❌ AUTH: initData відсутній!");
            console.log("Можливі причини:");
            console.log("1. Додаток відкритий НЕ через Telegram");
            console.log("2. Використовується старий Telegram клієнт");
            console.log("3. Проблема з HTTPS");
            throw new Error("initData відсутній - додаток має бути відкритий через Telegram");
        }

        // Формуємо дані для авторизації
        const authData = {
            // Основні дані
            id: telegramId,
            telegram_id: telegramId,

            // КРИТИЧНО: Додаємо initData без змін
            initData: tgWebApp.initData,

            // Додаткові дані користувача
            username: userData.username || tgWebApp.initDataUnsafe?.user?.username || '',
            first_name: userData.first_name || tgWebApp.initDataUnsafe?.user?.first_name || '',
            last_name: userData.last_name || tgWebApp.initDataUnsafe?.user?.last_name || '',
            language_code: userData.language_code || tgWebApp.initDataUnsafe?.user?.language_code || 'uk'
        };

        // Діагностика
        console.log('🔐 AUTH: Дані для авторизації:', {
            telegram_id: authData.telegram_id,
            hasInitData: !!authData.initData,
            initDataLength: authData.initData.length,
            username: authData.username
        });

        // Показуємо індикатор завантаження
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.add('show');

        // Виконуємо запит авторизації
        const response = await window.WinixAPI.apiRequest('/api/auth/telegram', 'POST', authData, {
            timeout: 15000,
            suppressErrors: false,
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': telegramId
            }
        });

        // Приховуємо індикатор завантаження
        if (spinner) spinner.classList.remove('show');

        if (response && response.status === 'success') {
            // Зберігаємо токен
            if (response.token) {
                localStorage.setItem('auth_token', response.token);

                // Розраховуємо час закінчення токену
                const expiresIn = response.expires_in || 86400; // 24 години за замовчуванням
                const expiryTime = Date.now() + (expiresIn * 1000);
                localStorage.setItem('auth_token_expiry', expiryTime.toString());
            }

            // Зберігаємо дані користувача
            window.WinixAuth.currentUser = response.user;
            console.log("✅ AUTH: Користувача успішно авторизовано", response.user);

            // Показуємо вітальне повідомлення для нових користувачів
            if (response.user && response.user.is_new_user) {
                showWelcomeMessage();
            }

            // Відправляємо подію про успішну авторизацію
            document.dispatchEvent(new CustomEvent(EVENT_AUTH_SUCCESS, {
                detail: response.user
            }));

            return response.user;
        } else {
            throw new Error(response?.message || "Помилка авторизації");
        }
    } catch (error) {
        console.error("❌ AUTH: Помилка авторизації", error);

        // Приховуємо індикатор завантаження
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.remove('show');

        // Показуємо відповідне повідомлення
        if (error.message.includes('initData')) {
            showError('Додаток має бути відкритий через Telegram');
        } else {
            showError(getLocalizedText('authError'));
        }

        // Відправляємо подію про помилку авторизації
        document.dispatchEvent(new CustomEvent(EVENT_AUTH_ERROR, {
            detail: error
        }));

        throw error;
    } finally {
        _authRequestInProgress = false;
    }
}

    /**
     * Отримання даних користувача з сервера
     * @param {boolean} forceRefresh - Примусове оновлення даних
     * @returns {Promise<Object>} Об'єкт з даними користувача
     */
    async function getUserData(forceRefresh = false) {
        // Перевіряємо Telegram ID
        const telegramId = getTelegramUserId();
        if (!telegramId) {
            blockAccess();
            return Promise.reject(new Error('No Telegram ID'));
        }

        // Запобігання паралельним запитам
        if (_userDataRequestInProgress) {
            console.log("🔐 AUTH: Запит даних користувача вже виконується");

            if (window.WinixAuth.currentUser) {
                return Promise.resolve(window.WinixAuth.currentUser);
            }

            return Promise.resolve({});
        }

        // Запобігання частим запитам
        const now = Date.now();
        const timeSinceLastRequest = now - _lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && !forceRefresh) {
            console.log(`🔐 AUTH: Занадто частий запит даних користувача`);

            if (window.WinixAuth.currentUser) {
                return Promise.resolve(window.WinixAuth.currentUser);
            }

            return Promise.resolve({});
        }

        _lastRequestTime = now;
        _userDataRequestInProgress = true;

        try {
            // Показуємо індикатор завантаження
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.add('show');

            // Перевіряємо наявність API модуля
            if (!hasApiModule()) {
                throw new Error("API module not available");
            }

            // Отримуємо дані користувача
            const response = await window.WinixAPI.getUserData(forceRefresh);

            // Приховуємо індикатор завантаження
            if (spinner) spinner.classList.remove('show');

            if (response && response.status === 'success' && response.user) {
                // Зберігаємо дані
                window.WinixAuth.currentUser = response.user;
                console.log("✅ AUTH: Дані користувача успішно отримано", response.user);

                // Відправляємо подію оновлення даних
                document.dispatchEvent(new CustomEvent(EVENT_USER_DATA_UPDATED, {
                    detail: response.user,
                    source: 'auth.js'
                }));

                return response.user;
            } else {
                throw new Error(response?.message || "Помилка отримання даних");
            }
        } catch (error) {
            console.error("❌ AUTH: Помилка отримання даних користувача", error);

            // Приховуємо індикатор завантаження
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.remove('show');

            showError(getLocalizedText('dataError'));

            // Генеруємо подію про помилку
            document.dispatchEvent(new CustomEvent(EVENT_AUTH_ERROR, {
                detail: {
                    error,
                    method: 'getUserData'
                }
            }));

            // Повертаємо порожній об'єкт при помилці
            return {};
        } finally {
            _userDataRequestInProgress = false;
        }
    }

    /**
     * Функція запуску періодичного оновлення
     * @param {number} interval - Інтервал оновлення в мілісекундах
     */
    function startPeriodicUpdate(interval = 120000) { // 2 хвилини за замовчуванням
        if (_periodicUpdateInterval) {
            stopPeriodicUpdate();
        }

        _periodicUpdateInterval = setInterval(function() {
            // Перевіряємо час останнього запиту
            if ((Date.now() - _lastRequestTime) >= MIN_REQUEST_INTERVAL && !_userDataRequestInProgress) {
                getUserData()
                    .then(() => console.log("✅ AUTH: Періодичне оновлення даних користувача"))
                    .catch(err => console.warn("⚠️ AUTH: Помилка періодичного оновлення:", err));
            }
        }, interval);

        console.log(`🔄 AUTH: Періодичне оновлення запущено (інтервал: ${interval}ms)`);
    }

    /**
     * Функція зупинки періодичного оновлення
     */
    function stopPeriodicUpdate() {
        if (_periodicUpdateInterval) {
            clearInterval(_periodicUpdateInterval);
            _periodicUpdateInterval = null;
            console.log("⏹️ AUTH: Періодичне оновлення зупинено");
        }
    }

    /**
     * Примусове оновлення даних користувача
     * @returns {Promise<Object>} Оновлені дані користувача
     */
    async function refreshUserData() {
        console.log("🔄 AUTH: Примусове оновлення даних користувача");
        return getUserData(true);
    }

    /**
     * Очищення кешу даних
     * @returns {Object} WinixAuth для ланцюжкових викликів
     */
    function clearCache() {
        console.log("🧹 AUTH: Очищення кешу даних");
        window.WinixAuth.currentUser = null;
        _lastRequestTime = 0;

        // Також очищаємо кеш в WinixAPI
        if (hasApiModule() && typeof window.WinixAPI.clearCache === 'function') {
            window.WinixAPI.clearCache();
        }

        return window.WinixAuth;
    }

    // ======== СТВОРЕННЯ ПУБЛІЧНОГО API ========

    window.WinixAuth = {
        // Дані поточного користувача
        currentUser: null,

        // Прапорці стану
        isInitialized: false,
        isAuthorizing: false,

        // Мови інтерфейсу
        lang: MESSAGES,

        // Методи перевірки
        isValidId,

        // Основні методи
        init,
        authorizeUser,
        getUserData,
        getTelegramUserId,
        refreshUserData,
        clearCache,

        // Методи для показу повідомлень
        showError,
        showWelcomeMessage,
        getLocalizedText,

        // Методи для періодичного оновлення
        startPeriodicUpdate,
        stopPeriodicUpdate,

        // Технічна інформація
        version: '2.0.0'
    };

    // ======== АВТОМАТИЧНА ІНІЦІАЛІЗАЦІЯ ========

document.addEventListener('DOMContentLoaded', function() {
    console.log("🔐 AUTH: DOMContentLoaded, автоматична ініціалізація");

    // Перевіряємо Telegram ID одразу
    const telegramId = getTelegramUserId();
    if (!telegramId) {
        blockAccess();
        return;
    }

    // Оновлюємо елемент на сторінці, якщо він є
    const userIdElement = document.getElementById('user-id');
    if (userIdElement) {
        userIdElement.textContent = telegramId;
    }

    // Запускаємо ініціалізацію
    init()
        .then(() => {
            console.log("✅ AUTH: Ініціалізацію успішно виконано");
            window.WinixAuth.isInitialized = true;
        })
        .catch(error => {
            console.error("❌ AUTH: Помилка ініціалізації:", error);
            window.WinixAuth.isInitialized = false;
        });
});

    // Запускаємо авторизацію для веб-аплікацій, які вже завантажилися
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        console.log("🔐 AUTH: Документ вже завантажено, запуск авторизації");

        setTimeout(() => {
            // Перевіряємо Telegram ID
            const telegramId = getTelegramUserId();
            if (!telegramId) {
                blockAccess();
                return;
            }

            // Оновлюємо дані користувача
            getUserData()
                .then(() => {
                    console.log("✅ AUTH: Дані користувача оновлено після завантаження");
                    window.WinixAuth.isInitialized = true;
                })
                .catch(error => {
                    console.error("❌ AUTH: Помилка завантаження даних користувача", error);
                });
        }, 100);
    }

    // Додаємо обробник події 'telegram-ready'
document.addEventListener('telegram-ready', function() {
    console.log("🔐 AUTH: Отримано подію telegram-ready, запуск авторизації");

    getUserData()
        .then(() => {
            console.log("✅ AUTH: Дані користувача оновлено після telegram-ready");
            window.WinixAuth.isInitialized = true;
        })
        .catch(error => {
            console.warn("⚠️ AUTH: Помилка оновлення даних після telegram-ready", error);
        });
});

    // Запускаємо періодичне оновлення
    startPeriodicUpdate();

    // Додаємо обробник подій для синхронізації з іншими модулями
    document.addEventListener(EVENT_USER_DATA_UPDATED, function(event) {
        if (event.detail && event.source !== 'auth.js') {
            console.log("🔄 AUTH: Оновлення даних користувача з іншого модуля");
            window.WinixAuth.currentUser = event.detail;
        }
    });


    // Позначаємо модуль як готовий
    if (window.WinixInit) {
        window.WinixInit.checkModule('auth');
    }

    console.log("✅ AUTH: Систему авторизації успішно ініціалізовано");
})();