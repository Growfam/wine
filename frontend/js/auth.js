/**
 * auth.js - Модуль авторизації для Telegram Mini App
 * Оптимізована версія з покращеним управлінням та інтеграцією з API
 * @version 1.1.0
 */

(function() {
    'use strict';

    console.log("🔐 AUTH: Ініціалізація системи авторизації");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Флаги для контролю запитів
    let _authRequestInProgress = false;
    let _userDataRequestInProgress = false;
    let _lastRequestTime = 0;

    // Мінімальний інтервал між запитами (8 секунд)
    const MIN_REQUEST_INTERVAL = 8000;

    // Підтримка подій
    const EVENT_USER_DATA_UPDATED = 'user-data-updated';
    const EVENT_AUTH_SUCCESS = 'auth-success';
    const EVENT_AUTH_ERROR = 'auth-error';
    const EVENT_TOKEN_REFRESHED = 'token-refreshed';

    // Для періодичного оновлення
    let _periodicUpdateInterval = null;

    // Поточна мова інтерфейсу
    let _currentLang = 'uk';

    // Перевірка базового API
    const hasApiModule = () => window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function';

    // Тексти повідомлень
    const MESSAGES = {
        uk: {
            authError: "Помилка авторизації. Спробуйте перезапустити додаток.",
            dataError: "Помилка отримання даних користувача.",
            welcome: "Вітаємо у WINIX!"
        },
        ru: {
            authError: "Ошибка авторизации. Попробуйте перезапустить приложение.",
            dataError: "Ошибка получения данных пользователя.",
            welcome: "Добро пожаловать в WINIX!"
        },
        en: {
            authError: "Authorization error. Try restarting the app.",
            dataError: "Error retrieving user data.",
            welcome: "Welcome to WINIX!"
        }
    };

    // Ініціалізуємо Telegram WebApp якомога раніше
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        console.log("🔐 AUTH: Telegram WebApp ініціалізовано - ранній старт");
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
               !id.toString().includes('=>');
    }

    /**
     * Отримати локалізований текст за поточною мовою
     * @param {string} key - Ключ повідомлення
     * @returns {string} - Локалізований текст
     */
    function getLocalizedText(key) {
        // Визначаємо мову через існуючу систему
        let currentLang = _currentLang;

        if (window.WinixLanguage && window.WinixLanguage.currentLang) {
            currentLang = window.WinixLanguage.currentLang;
        } else if (localStorage.getItem('userLanguage')) {
            currentLang = localStorage.getItem('userLanguage');
        }

        // Перевіряємо, чи є переклад для цієї мови
        if (MESSAGES[currentLang] && MESSAGES[currentLang][key]) {
            return MESSAGES[currentLang][key];
        }

        // Якщо немає, повертаємо український варіант
        return MESSAGES.uk[key];
    }

    /**
     * Показати повідомлення про помилку
     * @param {string} message - Текст повідомлення
     */
    function showError(message) {
        console.error("❌ AUTH: " + message);

        // Спочатку намагаємося використати існуючі функції
        if (window.simpleAlert) {
            window.simpleAlert(message, true);
            return;
        }

        if (window.showToast) {
            window.showToast(message, true);
            return;
        }

        // Якщо немає існуючих функцій, показуємо стандартний alert
        alert(message);
    }

    /**
     * Показати вітальне повідомлення
     */
    function showWelcomeMessage() {
        console.log("🔐 AUTH: Показ вітального повідомлення");

        const message = getLocalizedText('welcome');

        // Спочатку намагаємося використати існуючі функції
        if (window.simpleAlert) {
            window.simpleAlert(message, false);
            return;
        }

        if (window.showToast) {
            window.showToast(message);
            return;
        }

        // Якщо немає існуючих функцій, показуємо стандартний alert
        alert(message);
    }

    // ======== ФУНКЦІЇ АВТОРИЗАЦІЇ ========

    /**
     * Отримати ID користувача з усіх можливих джерел
     * @returns {string|null} ID користувача або null
     */
    function getUserIdFromAllSources() {
        // Використовуємо основний API якщо він доступний
        if (hasApiModule()) {
            const id = window.WinixAPI.getUserId();
            if (isValidId(id)) return id;
        }

        // 1. Перевіряємо Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp) {
            try {
                if (window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user &&
                    window.Telegram.WebApp.initDataUnsafe.user.id) {

                    const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();

                    if (isValidId(tgUserId)) {
                        try {
                            localStorage.setItem('telegram_user_id', tgUserId);
                        } catch (e) {}

                        return tgUserId;
                    }
                }
            } catch (e) {
                console.warn("🔐 AUTH: Помилка отримання ID з Telegram WebApp:", e);
            }
        }

        // 2. Перевіряємо localStorage
        try {
            const localId = localStorage.getItem('telegram_user_id');
            if (isValidId(localId)) {
                return localId;
            }
        } catch (e) {
            console.warn("🔐 AUTH: Помилка отримання ID з localStorage:", e);
        }

        // 3. Перевіряємо DOM елемент
        try {
            const userIdElement = document.getElementById('user-id');
            if (userIdElement && userIdElement.textContent) {
                const domId = userIdElement.textContent.trim();
                if (isValidId(domId)) {
                    try {
                        localStorage.setItem('telegram_user_id', domId);
                    } catch (e) {}

                    return domId;
                }
            }
        } catch (e) {
            console.warn("🔐 AUTH: Помилка отримання ID з DOM:", e);
        }

        // 4. Перевіряємо URL параметри
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            if (isValidId(urlId)) {
                try {
                    localStorage.setItem('telegram_user_id', urlId);
                } catch (e) {}

                return urlId;
            }
        } catch (e) {
            console.warn("🔐 AUTH: Помилка отримання ID з URL:", e);
        }

        // 5. Для сторінки налаштувань використовуємо тестовий ID
        const isSettingsPage = window.location.pathname.includes('general.html');
        if (isSettingsPage) {
            const testId = "7066583465";
            try {
                localStorage.setItem('telegram_user_id', testId);
            } catch (e) {}

            return testId;
        }

        return null;
    }

    /**
     * Ініціалізація системи авторизації
     * @returns {Promise<Object>} Об'єкт з даними користувача
     */
    async function init() {
        console.log("🔐 AUTH: Запуск ініціалізації");

        // Запобігання частим викликам init
        const now = Date.now();
        if ((now - _lastRequestTime) < MIN_REQUEST_INTERVAL) {
            console.log("🔐 AUTH: Занадто частий виклик init, ігноруємо");
            return Promise.reject(new Error("Занадто частий виклик init"));
        }
        _lastRequestTime = now;

        // Ініціалізуємо Telegram WebApp якомога раніше
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            console.log("🔐 AUTH: Telegram WebApp ініціалізовано");
        }

        // Видаляємо жорстко закодований ID з localStorage, якщо він там є
        if (localStorage.getItem('telegram_user_id') === '12345678') {
            console.warn("⚠️ AUTH: Видалення захардкодженого ID з localStorage");
            localStorage.removeItem('telegram_user_id');
        }

        // Перевіряємо, чи є Telegram WebApp
        if (!window.Telegram || !window.Telegram.WebApp) {
            console.error("❌ AUTH: Telegram WebApp не знайдено");
            return Promise.reject(new Error("Telegram WebApp not available"));
        }

        // Перевіряємо наявність API модуля
        if (!hasApiModule()) {
            console.error("❌ AUTH: API модуль недоступний");
            return Promise.reject(new Error("API module not available"));
        }

        // Перевіряємо необхідність оновлення токену через WinixAPI
        try {
            await window.WinixAPI.refreshToken();
        } catch (e) {
            console.warn("⚠️ AUTH: Помилка оновлення токену:", e);
        }

        // Отримуємо дані користувача через getUserData
        try {
            return await getUserData();
        } catch (error) {
            console.warn("⚠️ AUTH: Помилка під час getUserData, спробуємо authorizeUser:", error);

            // Якщо getUserData не спрацював, використовуємо authorizeUser як резервний варіант
            const tg = window.Telegram.WebApp;
            let authData = {};

            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                authData = {
                    ...tg.initDataUnsafe.user,
                    initData: tg.initData || ""
                };
            } else {
                authData = {
                    initData: tg.initData || ""
                };
            }

            return authorizeUser(authData);
        }
    }

    /**
     * Авторизація користувача на сервері
     * @param {Object} userData - Дані користувача з Telegram
     * @returns {Promise<Object>} Об'єкт з даними користувача
     */
    async function authorizeUser(userData) {
        // Запобігання паралельним запитам
        if (_authRequestInProgress) {
            console.log("🔐 AUTH: Авторизація вже виконується");
            return Promise.reject(new Error("Authorization already in progress"));
        }

        _authRequestInProgress = true;

        try {
            // Перевіряємо чи доступний Telegram WebApp і оновлюємо дані
            if (window.Telegram && window.Telegram.WebApp &&
                window.Telegram.WebApp.initDataUnsafe &&
                window.Telegram.WebApp.initDataUnsafe.user) {

                // Оновлюємо ID користувача з Telegram WebApp
                const telegramId = window.Telegram.WebApp.initDataUnsafe.user.id;
                if (telegramId) {
                    // Замість модифікації параметра, створюємо нову змінну
                    userData = {
                        ...userData,
                        id: telegramId.toString(),
                        telegram_id: telegramId.toString()
                    };
                    console.log("🔐 AUTH: ID оновлено з Telegram WebApp:", userData.id);
                }
            }

            // Валідуємо ID перед надсиланням запиту
            let userId = userData.id || userData.telegram_id || null;

            if (!isValidId(userId)) {
                console.error("❌ AUTH: Неможливо отримати валідний ID користувача для авторизації");
                throw new Error("Неможливо отримати валідний ID користувача");
            }

            // Використовуємо let замість const для userId
            userId = userId.toString();

            // Зберігаємо в localStorage для подальшого використання
            localStorage.setItem('telegram_user_id', userId);

            // Одразу оновлюємо елемент на сторінці, якщо він існує
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userIdElement.textContent = userId;
                console.log(`🔐 AUTH: Оновлено ID користувача на сторінці: ${userId}`);
            }

            // Показуємо індикатор завантаження, якщо він є
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.add('show');

            // Перевіряємо наявність API модуля
            if (!hasApiModule()) {
                console.error("❌ AUTH: API модуль недоступний");
                if (spinner) spinner.classList.remove('show');
                throw new Error("API модуль недоступний");
            }

            // Виконуємо запит авторизації через WinixAPI
            try {
                const response = await window.WinixAPI.apiRequest('api/auth', 'POST', userData, {
                    timeout: 15000, // Збільшуємо таймаут для авторизації
                    suppressErrors: true, // Для обробки помилок на нашому рівні
                });

                // Приховуємо індикатор завантаження
                if (spinner) spinner.classList.remove('show');

                if (response.status === 'success') {
                    // Зберігаємо дані користувача
                    const userData = response.data;
                    window.WinixAuth.currentUser = userData;
                    console.log("✅ AUTH: Користувача успішно авторизовано", userData);

                    // Перевіряємо валідність ID перед збереженням
                    if (isValidId(userData.telegram_id)) {
                        localStorage.setItem('telegram_user_id', userData.telegram_id);

                        // Оновлюємо елемент на сторінці
                        const userIdElement = document.getElementById('user-id');
                        if (userIdElement) {
                            userIdElement.textContent = userData.telegram_id;
                        }
                    } else {
                        console.warn("⚠️ AUTH: API повернув невалідний ID користувача:", userData.telegram_id);
                    }

                    // Зберігаємо баланс і жетони в localStorage
                    if (userData.balance !== undefined) {
                        localStorage.setItem('userTokens', userData.balance.toString());
                        localStorage.setItem('winix_balance', userData.balance.toString());
                    }

                    if (userData.coins !== undefined) {
                        localStorage.setItem('userCoins', userData.coins.toString());
                        localStorage.setItem('winix_coins', userData.coins.toString());
                    }

                    // Показуємо вітальне повідомлення для нових користувачів
                    if (response.data.is_new_user) {
                        showWelcomeMessage();
                    }

                    // Відправляємо подію про успішну авторизацію
                    document.dispatchEvent(new CustomEvent(EVENT_AUTH_SUCCESS, {
                        detail: userData
                    }));

                    // Також відправляємо подію оновлення даних для синхронізації з іншими модулями
                    document.dispatchEvent(new CustomEvent(EVENT_USER_DATA_UPDATED, {
                        detail: userData
                    }));

                    return userData;
                } else {
                    console.error("❌ AUTH: Помилка авторизації", response);
                    throw new Error(response.message || "Помилка авторизації");
                }
            } catch (error) {
                console.error("❌ AUTH: Помилка авторизації", error);

                // Додаткова діагностична інформація
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    console.error("❌ AUTH: Проблема мережевого з'єднання - сервер недоступний");
                } else if (error.status || error.statusText) {
                    console.error(`❌ AUTH: HTTP помилка (${error.status}): ${error.statusText}`);
                }

                // Приховуємо індикатор завантаження
                if (spinner) spinner.classList.remove('show');

                // Показуємо повідомлення про помилку
                let errorMessage = getLocalizedText('authError');
                if (error.status === 404) {
                    errorMessage += ' API не знайдено.';
                } else if (error.status === 500) {
                    errorMessage += ' Помилка на сервері.';
                } else if (error.status === 401) {
                    errorMessage += ' Помилка автентифікації.';
                }
                showError(errorMessage);

                // Відправляємо подію про помилку авторизації
                document.dispatchEvent(new CustomEvent(EVENT_AUTH_ERROR, {
                    detail: error
                }));

                throw error;
            }
        } catch (e) {
            console.error("❌ AUTH: Неочікувана помилка в authorizeUser:", e);
            return Promise.reject(e);
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
        // Запобігання паралельним запитам
        if (_userDataRequestInProgress) {
            console.log("🔐 AUTH: Запит даних користувача вже виконується");

            // Якщо є кешовані дані, повертаємо їх
            if (window.WinixAuth.currentUser) {
                return Promise.resolve(window.WinixAuth.currentUser);
            }

            return Promise.reject(new Error("Запит даних користувача вже виконується"));
        }

        // Запобігання частим запитам
        const now = Date.now();
        const timeSinceLastRequest = now - _lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && !forceRefresh) {
            console.log(`🔐 AUTH: Занадто частий запит даних користувача, залишилось ${Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest)/1000)}с`);

            // Якщо є кешовані дані, повертаємо їх
            if (window.WinixAuth.currentUser) {
                return Promise.resolve(window.WinixAuth.currentUser);
            }

            return Promise.reject({
                message: "Занадто частий запит даних користувача",
                retryAfter: MIN_REQUEST_INTERVAL - timeSinceLastRequest
            });
        }

        _lastRequestTime = now;
        _userDataRequestInProgress = true;

        try {
            // Отримуємо ID користувача
            const userId = getUserIdFromAllSources();
            if (!userId) {
                throw new Error("Не вдалося отримати ID користувача");
            }

            // Оновлюємо відображення ID на сторінці
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userIdElement.textContent = userId;
            }

            // Показуємо індикатор завантаження, якщо він є
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.add('show');

            // Перевіряємо наявність API модуля
            if (!hasApiModule()) {
                console.error("❌ AUTH: API модуль недоступний");
                if (spinner) spinner.classList.remove('show');
                throw new Error("API module not available");
            }

            try {
                // Отримуємо дані користувача через WinixAPI
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
                    console.error("❌ AUTH: Помилка отримання даних користувача", response);
                    throw new Error(response.message || "Помилка отримання даних");
                }
            } catch (error) {
                // Приховуємо індикатор завантаження
                if (spinner) spinner.classList.remove('show');

                console.error("❌ AUTH: Помилка отримання даних користувача", error);

                // Генеруємо подію про помилку
                document.dispatchEvent(new CustomEvent(EVENT_AUTH_ERROR, {
                    detail: {
                        error,
                        userId,
                        method: 'getUserData'
                    }
                }));

                // Показуємо повідомлення про помилку
                showError(getLocalizedText('dataError'));

                // Якщо не вдалося отримати свіжі дані, повертаємо старі (якщо вони є)
                if (window.WinixAuth.currentUser) {
                    console.warn("⚠️ AUTH: Використовуємо кешовані дані користувача");
                    return window.WinixAuth.currentUser;
                }

                throw error;
            }
        } catch (e) {
            console.error("❌ AUTH: Неочікувана помилка в getUserData:", e);
            return Promise.reject(e);
        } finally {
            _userDataRequestInProgress = false;
        }
    }

    /**
     * Функція для чищення невалідних даних
     * @returns {boolean} Чи були виконані дії з очищення
     */
    function cleanInvalidIds() {
        let cleaned = false;

        // Перевіряємо ID в localStorage
        const storedId = localStorage.getItem('telegram_user_id');
        if (storedId && !isValidId(storedId)) {
            console.warn("⚠️ AUTH: Видалення невалідного ID з localStorage:", storedId);
            localStorage.removeItem('telegram_user_id');
            cleaned = true;
        }

        // Перевіряємо наявність захардкодженого ID
        if (localStorage.getItem('telegram_user_id') === '12345678') {
            console.warn("⚠️ AUTH: Видалення захардкодженого ID з localStorage");
            localStorage.removeItem('telegram_user_id');
            cleaned = true;
        }

        return cleaned;
    }

    /**
     * Функція запуску періодичного оновлення
     * @param {number} interval - Інтервал оновлення в мілісекундах
     */
    function startPeriodicUpdate(interval = 120000) { // 2 хвилини за замовчуванням
        if (_periodicUpdateInterval) {
            stopPeriodicUpdate();
        }

        // Оновлюємо дані користувача з вказаним інтервалом
        _periodicUpdateInterval = setInterval(function() {
            // Перевіряємо час останнього запиту
            if ((Date.now() - _lastRequestTime) >= MIN_REQUEST_INTERVAL && !_userDataRequestInProgress) {
                if (hasApiModule()) {
                    getUserData()
                        .then(() => console.log("✅ AUTH: Періодичне оновлення даних користувача"))
                        .catch(err => console.warn("⚠️ AUTH: Помилка періодичного оновлення:", err));
                }
            }

            // Перевіряємо чи треба оновити токен (через WinixAPI)
            if (hasApiModule()) {
                try {
                    window.WinixAPI.refreshToken()
                        .then(() => console.log("✅ AUTH: Токен успішно оновлено"))
                        .catch(err => console.warn("⚠️ AUTH: Помилка оновлення токену:", err));
                } catch (e) {
                    console.warn("⚠️ AUTH: Помилка виклику refreshToken:", e);
                }
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

    // Глобальний об'єкт для зберігання даних користувача
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
        refreshUserData,
        cleanInvalidIds,
        clearCache,

        // Методи для показу повідомлень
        showError,
        showWelcomeMessage,
        getLocalizedText,

        // Методи для періодичного оновлення
        startPeriodicUpdate,
        stopPeriodicUpdate,

        // Технічна інформація
        version: '1.1.0'
    };

    // ======== АВТОМАТИЧНА ІНІЦІАЛІЗАЦІЯ ========

    // Ініціалізуємо при завантаженні DOM
    document.addEventListener('DOMContentLoaded', function() {
        console.log("🔐 AUTH: DOMContentLoaded, автоматична ініціалізація");

        // Спочатку очищаємо невалідні дані
        cleanInvalidIds();

        // Перевіряємо, чи валідний ID в localStorage
        const storedId = localStorage.getItem('telegram_user_id');
        if (isValidId(storedId)) {
            // Оновлюємо елемент на сторінці, якщо він є
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userIdElement.textContent = storedId;
                console.log(`🔐 AUTH: Відновлено ID користувача зі сховища: ${storedId}`);
            }
        }

        // Безпечна ініціалізація для всіх сторінок
        try {
            // Отримуємо дані користувача
            getUserData()
                .then(userData => {
                    console.log("✅ AUTH: Дані користувача успішно отримано при ініціалізації");
                    window.WinixAuth.isInitialized = true;
                })
                .catch(error => {
                    console.warn("⚠️ AUTH: Помилка отримання даних при ініціалізації:", error);

                    // Пробуємо виконати повну ініціалізацію
                    init()
                        .then(() => {
                            console.log("✅ AUTH: Повну ініціалізацію успішно виконано");
                            window.WinixAuth.isInitialized = true;
                        })
                        .catch(err => {
                            console.error("❌ AUTH: Критична помилка ініціалізації:", err);
                        });
                });
        } catch (error) {
            console.error("❌ AUTH: Помилка автоматичної ініціалізації:", error);
        }
    });

    // Запускаємо авторизацію для веб-аплікацій, які вже завантажилися
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        console.log("🔐 AUTH: Документ вже завантажено, запуск авторизації");

        setTimeout(() => {
            // Спочатку очищаємо невалідні ID
            cleanInvalidIds();

            // Оновлюємо дані користувача
            getUserData()
                .then(() => {
                    console.log("✅ AUTH: Дані користувача оновлено після завантаження");
                    window.WinixAuth.isInitialized = true;
                })
                .catch(error => {
                    console.warn("⚠️ AUTH: Помилка завантаження даних користувача", error);

                    // Пробуємо виконати повну ініціалізацію
                    init()
                        .then(() => {
                            console.log("✅ AUTH: Повну ініціалізацію успішно виконано");
                            window.WinixAuth.isInitialized = true;
                        })
                        .catch(err => {
                            console.error("❌ AUTH: Критична помилка ініціалізації:", err);
                        });
                });
        }, 100);
    }

    // Додаємо обробник події 'telegram-ready', якщо використовуються події
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

    // Запускаємо періодичне оновлення, але не для сторінки налаштувань
    if (!window.location.pathname.includes('general.html')) {
        startPeriodicUpdate();
    }

    // Додаємо обробник подій для переключення сторінок (якщо є History API)
    window.addEventListener('popstate', function() {
        const isSettingsPage = window.location.pathname.includes('general.html');
        if (isSettingsPage) {
            stopPeriodicUpdate();
        } else if (!_periodicUpdateInterval) {
            startPeriodicUpdate();
        }
    });

    // Додаємо обробник подій для синхронізації з іншими модулями
    document.addEventListener(EVENT_USER_DATA_UPDATED, function(event) {
        if (event.detail && event.source !== 'auth.js') {
            console.log("🔄 AUTH: Оновлення даних користувача з іншого модуля");
            window.WinixAuth.currentUser = event.detail;
        }
    });

    // Обробник помилок мережі
    window.addEventListener('offline', function() {
        console.warn("⚠️ AUTH: Пристрій втратив з'єднання з мережею");
    });

    window.addEventListener('online', function() {
        console.log("🔄 AUTH: З'єднання з мережею відновлено, спроба підключення");

        // Використовуємо WinixAPI.reconnect() якщо доступний
        if (hasApiModule() && typeof window.WinixAPI.reconnect === 'function') {
            window.WinixAPI.reconnect()
                .then(result => {
                    if (result) {
                        console.log("✅ AUTH: З'єднання успішно відновлено");
                        // Оновлюємо дані користувача
                        refreshUserData();
                    }
                });
        } else {
            // Якщо недоступний, просто оновлюємо дані
            refreshUserData();
        }
    });

    console.log("✅ AUTH: Систему авторизації успішно ініціалізовано");
})();