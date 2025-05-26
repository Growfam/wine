/**
 * auth.js - Модуль авторизації для Telegram Mini App
 * ВИПРАВЛЕНА ВЕРСІЯ з покращеною обробкою помилок та fallback механізмами
 * @version 3.0.0
 */

(function() {
    'use strict';

    console.log("🔐 AUTH: Ініціалізація ВИПРАВЛЕНОЇ системи авторизації");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Флаги для контролю запитів
    let _authRequestInProgress = false;
    let _userDataRequestInProgress = false;
    let _lastRequestTime = 0;

    // Мінімальний інтервал між запитами (10 секунд замість 15)
    const MIN_REQUEST_INTERVAL = 10000;

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
            accessDenied: "Доступ заборонено. Відкрийте додаток через Telegram.",
            connectionIssue: "Проблеми з підключенням. Працюємо в офлайн режимі."
        },
        ru: {
            authError: "Ошибка авторизации. Попробуйте перезапустить приложение.",
            dataError: "Ошибка получения данных пользователя.",
            welcome: "Добро пожаловать в WINIX!",
            noTelegramId: "Приложение доступно только через Telegram",
            accessDenied: "Доступ запрещен. Откройте приложение через Telegram.",
            connectionIssue: "Проблемы с подключением. Работаем в офлайн режиме."
        },
        en: {
            authError: "Authorization error. Try restarting the app.",
            dataError: "Error retrieving user data.",
            welcome: "Welcome to WINIX!",
            noTelegramId: "App is only available through Telegram",
            accessDenied: "Access denied. Open the app through Telegram.",
            connectionIssue: "Connection issues. Working in offline mode."
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
               /^\d+$/.test(id.toString());
    }

    /**
     * М'яке блокування доступу (тепер з fallback опціями)
     */
    function softBlockAccess() {
        console.warn("⚠️ AUTH: М'яке блокування доступу - немає валідного Telegram ID");

        document.dispatchEvent(new CustomEvent(EVENT_ACCESS_DENIED));

        const message = getLocalizedText('accessDenied');
        showError(message, 'warning'); // warning замість error

        // НЕ приховуємо контент повністю, показуємо повідомлення
        const blockScreen = document.createElement('div');
        blockScreen.id = 'soft-block-screen';
        blockScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(26, 26, 26, 0.95);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 16px;
            z-index: 999999;
            backdrop-filter: blur(5px);
        `;
        blockScreen.innerHTML = `
            <div style="max-width: 300px; padding: 20px;">
                <h2 style="margin-bottom: 15px;">🔐 ${getLocalizedText('noTelegramId')}</h2>
                <p style="margin-bottom: 20px; opacity: 0.9;">${message}</p>
                <button onclick="window.WinixAuth.retryInit()" style="
                    background: #007ACC;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                ">Спробувати ще раз</button>
            </div>
        `;

        // Видаляємо старий екран якщо є
        const oldScreen = document.getElementById('soft-block-screen');
        if (oldScreen) oldScreen.remove();

        document.body.appendChild(blockScreen);
    }

    /**
     * Приховати екран блокування
     */
    function hideSoftBlockScreen() {
        const blockScreen = document.getElementById('soft-block-screen');
        if (blockScreen) {
            blockScreen.remove();
            console.log("✅ AUTH: Екран блокування приховано");
        }
    }

    /**
     * Отримання локалізований текст за поточною мовою
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
     */
    function showError(message, type = 'error') {
        console.error("❌ AUTH: " + message);

        if (window.simpleAlert) {
            window.simpleAlert(message, type === 'error');
            return;
        }

        if (window.showToast) {
            window.showToast(message, type);
            return;
        }

        // Fallback alert
        if (type === 'error') {
            alert(message);
        }
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
            window.showToast(message, 'success');
            return;
        }
    }

    /**
     * Показати повідомлення про проблеми з підключенням
     */
    function showConnectionIssue() {
        const message = getLocalizedText('connectionIssue');
        console.warn("⚠️ AUTH: " + message);

        if (window.showToast) {
            window.showToast(message, 'warning');
            return;
        }

        showError(message, 'warning');
    }

    // ======== ФУНКЦІЇ АВТОРИЗАЦІЇ ========

    /**
     * Отримати ID користувача ТІЛЬКИ з Telegram WebApp
     */
    function getTelegramUserId() {
        try {
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
     * Отримання fallback даних користувача
     */
    function getFallbackUserData(telegramId) {
        return {
            telegram_id: telegramId,
            username: `User_${telegramId.slice(-4)}`,
            balance: 0,
            coins: 0,
            is_new_user: false,
            fallback: true,
            offline_mode: true
        };
    }

    /**
     * ПОКРАЩЕНА ініціалізація системи авторизації
     */
    async function init() {
        console.log("🔐 AUTH: Запуск ПОКРАЩЕНОЇ ініціалізації");

        const now = Date.now();
        if ((now - _lastRequestTime) < MIN_REQUEST_INTERVAL) {
            console.log("🔐 AUTH: Частий виклик init, використовуємо кешовані дані");

            if (window.WinixAuth.currentUser) {
                return Promise.resolve(window.WinixAuth.currentUser);
            }

            return Promise.resolve(getFallbackUserData('000000'));
        }

        _lastRequestTime = now;

        // Перевіряємо Telegram ID
        const telegramId = getTelegramUserId();
        if (!telegramId) {
            console.warn("⚠️ AUTH: Немає Telegram ID, але продовжуємо з fallback");
            softBlockAccess();

            // Повертаємо fallback дані замість повної блокування
            const fallbackData = getFallbackUserData('000000');
            window.WinixAuth.currentUser = fallbackData;
            return Promise.resolve(fallbackData);
        }

        // Приховуємо екран блокування якщо він є
        hideSoftBlockScreen();

        // Перевіряємо наявність API модуля
        if (!hasApiModule()) {
            console.warn("⚠️ AUTH: API модуль недоступний, використовуємо fallback");
            showConnectionIssue();

            const fallbackData = getFallbackUserData(telegramId);
            window.WinixAuth.currentUser = fallbackData;
            return Promise.resolve(fallbackData);
        }

        try {
            console.log('🔄 [AUTH] Спроба оновлення токену');

            // Спробуємо оновити токен (без блокування при помилці)
            try {
                await window.WinixAPI.refreshToken();
                console.log('✅ [AUTH] Токен успішно оновлено');
            } catch (e) {
                console.warn("⚠️ AUTH: Помилка оновлення токену, продовжуємо без нього:", e);
                showConnectionIssue();
            }

            // Отримуємо дані користувача (з fallback при помилці)
            return await getUserData();
        } catch (error) {
            console.warn("⚠️ AUTH: Помилка ініціалізації, використовуємо fallback:", error);
            showConnectionIssue();

            const fallbackData = getFallbackUserData(telegramId);
            window.WinixAuth.currentUser = fallbackData;
            return Promise.resolve(fallbackData);
        }
    }

    /**
     * ПОКРАЩЕНА авторизація користувача на сервері
     */
    async function authorizeUser(userData) {
        if (_authRequestInProgress) {
            console.log("🔐 AUTH: Авторизація вже виконується");
            return Promise.resolve(window.WinixAuth.currentUser || {});
        }

        _authRequestInProgress = true;

        try {
            const telegramId = getTelegramUserId();
            if (!telegramId) {
                console.warn("⚠️ AUTH: Немає Telegram ID для авторизації");
                throw new Error("No Telegram ID");
            }

            // Оновлюємо userData з актуальним ID
            userData = {
                ...userData,
                id: telegramId,
                telegram_id: telegramId
            };

            // Показуємо індикатор завантаження
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.add('show');

            // Перевіряємо наявність API модуля
            if (!hasApiModule()) {
                console.warn("⚠️ AUTH: API модуль недоступний для авторизації");
                throw new Error("API module not available");
            }

            // Виконуємо запит авторизації з покращеною обробкою помилок
            const response = await window.WinixAPI.apiRequest('api/auth', 'POST', userData, {
                timeout: 12000,
                suppressErrors: true // Включаємо м'яку обробку помилок
            });

            // Приховуємо індикатор завантаження
            if (spinner) spinner.classList.remove('show');

            if (response && response.status === 'success' && response.data) {
                // Зберігаємо дані користувача
                window.WinixAuth.currentUser = response.data;
                console.log("✅ AUTH: Користувача успішно авторизовано", response.data);

                // Показуємо вітальне повідомлення для нових користувачів
                if (response.data.is_new_user) {
                    showWelcomeMessage();
                }

                // Відправляємо подію про успішну авторизацію
                document.dispatchEvent(new CustomEvent(EVENT_AUTH_SUCCESS, {
                    detail: response.data
                }));

                return response.data;
            } else {
                // М'яка обробка помилки - використовуємо fallback
                console.warn("⚠️ AUTH: Сервер недоступний, використовуємо fallback дані");
                showConnectionIssue();

                const fallbackData = getFallbackUserData(telegramId);
                window.WinixAuth.currentUser = fallbackData;
                return fallbackData;
            }
        } catch (error) {
            console.warn("⚠️ AUTH: Помилка авторизації, використовуємо fallback", error);

            // Приховуємо індикатор завантаження
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.remove('show');

            // Замість блокування показуємо попередження і використовуємо fallback
            const telegramId = getTelegramUserId();
            if (telegramId) {
                showConnectionIssue();
                const fallbackData = getFallbackUserData(telegramId);
                window.WinixAuth.currentUser = fallbackData;

                // Відправляємо подію про помилку, але не блокуємо роботу
                document.dispatchEvent(new CustomEvent(EVENT_AUTH_ERROR, {
                    detail: { error, fallback: true }
                }));

                return fallbackData;
            } else {
                // Тільки якщо немає Telegram ID взагалі
                softBlockAccess();
                throw error;
            }
        } finally {
            _authRequestInProgress = false;
        }
    }

    /**
     * ПОКРАЩЕНЕ отримання даних користувача з сервера
     */
    async function getUserData(forceRefresh = false) {
        const telegramId = getTelegramUserId();
        if (!telegramId) {
            console.warn("⚠️ AUTH: Немає Telegram ID для отримання даних");
            softBlockAccess();
            return getFallbackUserData('000000');
        }

        // Запобігання паралельним запитам
        if (_userDataRequestInProgress) {
            console.log("🔐 AUTH: Запит даних користувача вже виконується");

            if (window.WinixAuth.currentUser) {
                return Promise.resolve(window.WinixAuth.currentUser);
            }

            return Promise.resolve(getFallbackUserData(telegramId));
        }

        // Запобігання частим запитам
        const now = Date.now();
        const timeSinceLastRequest = now - _lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && !forceRefresh) {
            console.log(`🔐 AUTH: Занадто частий запит даних користувача`);

            if (window.WinixAuth.currentUser) {
                return Promise.resolve(window.WinixAuth.currentUser);
            }

            return Promise.resolve(getFallbackUserData(telegramId));
        }

        _lastRequestTime = now;
        _userDataRequestInProgress = true;

        try {
            // Показуємо індикатор завантаження
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.add('show');

            // Перевіряємо наявність API модуля
            if (!hasApiModule()) {
                console.warn("⚠️ AUTH: API модуль недоступний");
                throw new Error("API module not available");
            }

            // Отримуємо дані користувача з м'якою обробкою помилок
            const response = await window.WinixAPI.getUserData(forceRefresh);

            // Приховуємо індикатор завантаження
            if (spinner) spinner.classList.remove('show');

            if (response && response.status === 'success' && response.data) {
                // Зберігаємо дані
                window.WinixAuth.currentUser = response.data;
                console.log("✅ AUTH: Дані користувача успішно отримано", response.data);

                // Відправляємо подію оновлення даних
                document.dispatchEvent(new CustomEvent(EVENT_USER_DATA_UPDATED, {
                    detail: response.data,
                    source: 'auth.js'
                }));

                return response.data;
            } else {
                throw new Error(response?.message || "Помилка отримання даних");
            }
        } catch (error) {
            console.warn("⚠️ AUTH: Помилка отримання даних користувача, використовуємо fallback", error);

            // Приховуємо індикатор завантаження
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.remove('show');

            // Показуємо попередження про проблеми з підключенням
            showConnectionIssue();

            // Генеруємо подію про помилку
            document.dispatchEvent(new CustomEvent(EVENT_AUTH_ERROR, {
                detail: {
                    error,
                    method: 'getUserData',
                    fallback: true
                }
            }));

            // Повертаємо fallback дані замість порожнього об'єкта
            const fallbackData = getFallbackUserData(telegramId);
            window.WinixAuth.currentUser = fallbackData;
            return fallbackData;
        } finally {
            _userDataRequestInProgress = false;
        }
    }

    /**
     * Функція запуску періодичного оновлення (менш агресивна)
     */
    function startPeriodicUpdate(interval = 300000) { // 5 хвилин замість 2
        if (_periodicUpdateInterval) {
            stopPeriodicUpdate();
        }

        _periodicUpdateInterval = setInterval(function() {
            // Перевіряємо час останнього запиту та чи не виконується інший запит
            if ((Date.now() - _lastRequestTime) >= MIN_REQUEST_INTERVAL &&
                !_userDataRequestInProgress &&
                !_authRequestInProgress) {

                getUserData()
                    .then(() => console.log("✅ AUTH: Періодичне оновлення даних користувача"))
                    .catch(err => console.warn("⚠️ AUTH: Помилка періодичного оновлення:", err));
            }
        }, interval);

        console.log(`🔄 AUTH: М'яке періодичне оновлення запущено (інтервал: ${interval}ms)`);
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
     */
    async function refreshUserData() {
        console.log("🔄 AUTH: Примусове оновлення даних користувача");
        return getUserData(true);
    }

    /**
     * Повторна спроба ініціалізації
     */
    async function retryInit() {
        console.log("🔄 AUTH: Повторна спроба ініціалізації");

        // Скидаємо час останнього запиту
        _lastRequestTime = 0;

        // Приховуємо екран блокування
        hideSoftBlockScreen();

        try {
            const userData = await init();
            console.log("✅ AUTH: Повторна ініціалізація успішна");
            return userData;
        } catch (error) {
            console.warn("⚠️ AUTH: Помилка повторної ініціалізації:", error);
            return getFallbackUserData(getTelegramUserId() || '000000');
        }
    }

    /**
     * Очищення кешу даних
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
        retryInit, // НОВИЙ метод

        // Методи для показу повідомлень
        showError,
        showWelcomeMessage,
        getLocalizedText,
        showConnectionIssue, // НОВИЙ метод

        // Методи для періодичного оновлення
        startPeriodicUpdate,
        stopPeriodicUpdate,

        // Методи для роботи з блокуванням
        softBlockAccess,
        hideSoftBlockScreen,

        // Fallback методи
        getFallbackUserData,
        hasApiModule,

        // Технічна інформація
        version: '3.0.0'
    };

    // ======== АВТОМАТИЧНА ІНІЦІАЛІЗАЦІЯ ========

    // Ініціалізуємо при завантаженні DOM
    document.addEventListener('DOMContentLoaded', function() {
        console.log("🔐 AUTH: DOMContentLoaded, автоматична ініціалізація");

        // Перевіряємо Telegram ID
        const telegramId = getTelegramUserId();
        if (!telegramId) {
            console.warn("⚠️ AUTH: Немає Telegram ID при DOMContentLoaded");
            // НЕ блокуємо одразу, даємо шанс
        }

        // Оновлюємо елемент на сторінці, якщо він є
        const userIdElement = document.getElementById('user-id');
        if (userIdElement && telegramId) {
            userIdElement.textContent = telegramId;
            console.log(`🔐 AUTH: Встановлено ID користувача: ${telegramId}`);
        }

        // Запускаємо ініціалізацію з fallback обробкою
        init()
            .then((userData) => {
                console.log("✅ AUTH: Ініціалізацію успішно виконано", userData);
                window.WinixAuth.isInitialized = true;
            })
            .catch(error => {
                console.warn("⚠️ AUTH: Помилка ініціалізації, але продовжуємо роботу:", error);
                window.WinixAuth.isInitialized = true; // Позначаємо як ініціалізований навіть з помилками
            });
    });

    // Запускаємо авторизацію для веб-аплікацій, які вже завантажилися
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        console.log("🔐 AUTH: Документ вже завантажено, запуск авторизації");

        setTimeout(() => {
            const telegramId = getTelegramUserId();

            // Оновлюємо дані користувача (з fallback обробкою)
            getUserData()
                .then((userData) => {
                    console.log("✅ AUTH: Дані користувача оновлено після завантаження", userData);
                    window.WinixAuth.isInitialized = true;
                })
                .catch(error => {
                    console.warn("⚠️ AUTH: Помилка завантаження даних користувача, використовуємо fallback", error);
                    window.WinixAuth.isInitialized = true;
                });
        }, 100);
    }

    // Додаємо обробник події 'telegram-ready'
    document.addEventListener('telegram-ready', function() {
        console.log("🔐 AUTH: Отримано подію telegram-ready, запуск авторизації");

        getUserData()
            .then((userData) => {
                console.log("✅ AUTH: Дані користувача оновлено після telegram-ready", userData);
                window.WinixAuth.isInitialized = true;
            })
            .catch(error => {
                console.warn("⚠️ AUTH: Помилка оновлення даних після telegram-ready, використовуємо fallback", error);
                window.WinixAuth.isInitialized = true;
            });
    });

    // Запускаємо м'яке періодичне оновлення
    startPeriodicUpdate();

    // Додаємо обробник подій для синхронізації з іншими модулями
    document.addEventListener(EVENT_USER_DATA_UPDATED, function(event) {
        if (event.detail && event.source !== 'auth.js') {
            console.log("🔄 AUTH: Оновлення даних користувача з іншого модуля");
            window.WinixAuth.currentUser = event.detail;
        }
    });

    console.log("✅ AUTH: ВИПРАВЛЕНУ систему авторизації успішно ініціалізовано");
})();