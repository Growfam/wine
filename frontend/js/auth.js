/**
 * auth.js - Модуль авторизації для Telegram Mini App
 * Оптимізована версія з покращеним управлінням та інтеграцією з API
 * @version 1.2.0
 */

(function() {
    'use strict';

    console.log("🔐 AUTH: Ініціалізація системи авторизації");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Флаги для контролю запитів
    let _authRequestInProgress = false;
    let _userDataRequestInProgress = false;
    let _lastRequestTime = 0;
    let _lastTokenRefreshTime = 0;

    // Мінімальний інтервал між запитами (збільшено з 8 до 15 секунд)
    const MIN_REQUEST_INTERVAL = 15000;
    // Мінімальний інтервал для оновлення токена (10 хвилин)
    const MIN_TOKEN_REFRESH_INTERVAL = 600000;
    // Термін дії токена за замовчуванням - 7 днів у мілісекундах
    const DEFAULT_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000;

    // Підтримка подій
    const EVENT_USER_DATA_UPDATED = 'user-data-updated';
    const EVENT_AUTH_SUCCESS = 'auth-success';
    const EVENT_AUTH_ERROR = 'auth-error';
    const EVENT_TOKEN_REFRESHED = 'token-refreshed';

    // Для періодичного оновлення
    let _periodicUpdateInterval = null;

    // Поточна мова інтерфейсу
    let _currentLang = 'uk';

    // Перевірка базового API з додатковими перевірками
    const hasApiModule = () => {
        try {
            return window.WinixAPI &&
                   typeof window.WinixAPI.apiRequest === 'function' &&
                   typeof window.WinixAPI.getUserId === 'function';
        } catch (e) {
            console.error("🔐 AUTH: Помилка перевірки API модуля:", e);
            return false;
        }
    };

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
     * Покращена перевірка валідності ID
     * @param {any} id - ID для перевірки
     * @returns {boolean} - Чи валідний ID
     */
    function isValidId(id) {
        // Базові перевірки на null, undefined та пусті значення
        if (id === null ||
            id === undefined ||
            id === 'undefined' ||
            id === 'null' ||
            typeof id === 'function' ||
            (typeof id === 'string' && id.trim() === '')) {
            return false;
        }

        // Перевіряємо чи не місить функціональних блоків
        const strValue = String(id);
        if (strValue.includes('function') ||
            strValue.includes('=>') ||
            strValue.includes('undefined') ||
            strValue.includes('null')) {
            return false;
        }

        // Перевіряємо формат Telegram ID (має бути цифровим, можливо з префіксом -100 для чатів)
        // 1. Звичайні ID користувачів - просто цифри
        if (/^\d+$/.test(strValue)) {
            return true;
        }

        // 2. ID групових чатів - можуть починатися з -100
        if (/^-100\d+$/.test(strValue)) {
            return true;
        }

        // Додаткова перевірка на типову довжину Telegram ID (більше 5 цифр)
        const digitsOnly = strValue.replace(/\D/g, '');
        if (digitsOnly.length >= 5 && !isNaN(Number(digitsOnly))) {
            console.warn(`🔐 AUTH: ID "${strValue}" має нестандартний формат, але може бути валідним`);
            return true;
        }

        return false;
    }

    /**
     * Нормалізує формат ID
     * @param {any} id - ID для нормалізації
     * @returns {string} - Нормалізований ID
     */
    function normalizeId(id) {
        if (!id) return null;

        // Перетворюємо на рядок
        let strId = String(id).trim();

        // Видаляємо потенційні префікси від JSON
        strId = strId.replace(/^["'](.*)["']$/, '$1');

        // Обробка групових чатів
        if (strId.startsWith('-100')) {
            return strId;
        }

        // Видаляємо всі не-цифрові символи для звичайних ID
        const digitsOnly = strId.replace(/\D/g, '');

        if (digitsOnly.length > 0) {
            return digitsOnly;
        }

        return null;
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

    /**
     * Перевіряє та управляє токеном авторизації
     * @returns {Object} Об'єкт з інформацією про токен
     */
    function checkAuthToken() {
        try {
            const tokenData = localStorage.getItem('auth_token_data');
            if (!tokenData) {
                return { valid: false, reason: 'no_token' };
            }

            const parsedData = JSON.parse(tokenData);
            const token = parsedData.token;
            const expiresAt = new Date(parsedData.expires_at);
            const now = new Date();

            // Перевіряємо, чи термін дії токена закінчується протягом дня
            const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            if (expiresAt < now) {
                return { valid: false, reason: 'expired', token };
            } else if (expiresAt < oneDayFromNow) {
                return { valid: true, expiringSoon: true, token, expiresAt };
            }

            return { valid: true, token, expiresAt };
        } catch (e) {
            console.error("🔐 AUTH: Помилка перевірки токена:", e);
            return { valid: false, reason: 'error', error: e };
        }
    }

    /**
     * Оновлює токен авторизації
     * @param {string} token - Токен авторизації
     * @param {string} expiresAt - Дата закінчення терміну дії
     */
    function updateAuthToken(token, expiresAt) {
        try {
            if (!token) {
                console.error("🔐 AUTH: Спроба збереження порожнього токена!");
                return false;
            }

            const tokenData = {
                token,
                expires_at: expiresAt || new Date(Date.now() + DEFAULT_TOKEN_EXPIRY).toISOString(),
                updated_at: new Date().toISOString()
            };

            localStorage.setItem('auth_token_data', JSON.stringify(tokenData));
            _lastTokenRefreshTime = Date.now();

            // Відправляємо подію про оновлення токена
            document.dispatchEvent(new CustomEvent(EVENT_TOKEN_REFRESHED, {
                detail: { token, expiresAt }
            }));

            return true;
        } catch (e) {
            console.error("🔐 AUTH: Помилка збереження токена:", e);
            return false;
        }
    }

    // ======== ФУНКЦІЇ АВТОРИЗАЦІЇ ========

    /**
     * Покращена функція отримання ID користувача з усіх можливих джерел
     * @returns {string|null} ID користувача або null
     */
    function getUserIdFromAllSources() {
        try {
            console.log("🔐 AUTH: Спроба отримання ID користувача з усіх джерел");

            // Список для зберігання всіх знайдених ID для подальшого аналізу
            const foundIds = [];

            // 1. Перевірка кешованого ID
            const cachedUser = window.WinixAuth?.currentUser;
            if (cachedUser && isValidId(cachedUser.telegram_id)) {
                foundIds.push({id: cachedUser.telegram_id, source: 'cache', priority: 5});
            }

            // 2. Перевірка API модуля
            if (hasApiModule()) {
                const apiId = window.WinixAPI.getUserId();
                if (isValidId(apiId)) {
                    foundIds.push({id: apiId, source: 'api', priority: 4});
                }
            }

            // 3. Перевірка Telegram WebApp
            if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
                const tgUserId = String(window.Telegram.WebApp.initDataUnsafe.user.id);
                if (isValidId(tgUserId)) {
                    foundIds.push({id: tgUserId, source: 'telegram', priority: 5});
                }
            }

            // 4. Перевірка localStorage з верифікацією
            try {
                const localId = localStorage.getItem('telegram_user_id');
                const localIdVerified = localStorage.getItem('telegram_user_id_verified');

                if (isValidId(localId)) {
                    // Якщо ID був верифікований, надаємо йому вищий пріоритет
                    const priority = localIdVerified === 'true' ? 3 : 2;
                    foundIds.push({id: localId, source: 'localStorage', priority});
                }
            } catch (e) {
                console.warn("🔐 AUTH: Помилка доступу до localStorage:", e);
            }

            // 5. Перевірка sessionStorage
            try {
                const sessionId = sessionStorage.getItem('telegram_user_id');
                if (isValidId(sessionId)) {
                    foundIds.push({id: sessionId, source: 'sessionStorage', priority: 3});
                }
            } catch (e) {
                console.warn("🔐 AUTH: Помилка доступу до sessionStorage:", e);
            }

            // 6. Перевірка DOM елементу
            try {
                const userIdElement = document.getElementById('user-id');
                if (userIdElement && userIdElement.textContent) {
                    const domId = userIdElement.textContent.trim();
                    if (isValidId(domId)) {
                        foundIds.push({id: domId, source: 'dom', priority: 1});
                    }
                }
            } catch (e) {
                console.warn("🔐 AUTH: Помилка отримання ID з DOM:", e);
            }

            // 7. Перевірка URL параметрів
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
                if (isValidId(urlId)) {
                    foundIds.push({id: urlId, source: 'url', priority: 2});
                }
            } catch (e) {
                console.warn("🔐 AUTH: Помилка отримання ID з URL:", e);
            }

            // 8. Перевірка JWT токена, якщо він є
            try {
                const tokenData = localStorage.getItem('auth_token_data');
                if (tokenData) {
                    const parsedToken = JSON.parse(tokenData);

                    // Якщо в токені зберігається ID користувача
                    // Примітка: цей розділ залежить від формату вашого JWT
                    if (parsedToken.user_id && isValidId(parsedToken.user_id)) {
                        foundIds.push({id: parsedToken.user_id, source: 'jwt', priority: 3});
                    } else {
                        // Спроба декодувати JWT токен (якщо формат простий)
                        try {
                            const token = parsedToken.token;
                            if (token && token.split('.').length === 3) {
                                const payload = JSON.parse(atob(token.split('.')[1]));
                                if (payload.user_id && isValidId(payload.user_id)) {
                                    foundIds.push({id: payload.user_id, source: 'jwt_decoded', priority: 3});
                                }
                            }
                        } catch (decodeError) {
                            console.warn("🔐 AUTH: Помилка декодування JWT:", decodeError);
                        }
                    }
                }
            } catch (e) {
                console.warn("🔐 AUTH: Помилка доступу до JWT токена:", e);
            }

            // Якщо знайдено хоча б один ID, сортуємо за пріоритетом і повертаємо найкращий
            if (foundIds.length > 0) {
                // Сортуємо за пріоритетом (спадання)
                foundIds.sort((a, b) => b.priority - a.priority);

                // Беремо ID з найвищим пріоритетом
                const bestMatch = foundIds[0];
                const normalizedId = normalizeId(bestMatch.id);

                if (!normalizedId) {
                    console.error("🔐 AUTH: Знайдений ID не пройшов нормалізацію:", bestMatch.id);
                    if (foundIds.length > 1) {
                        const secondBest = foundIds[1];
                        const secondNormalized = normalizeId(secondBest.id);
                        if (secondNormalized) {
                            console.log(`🔐 AUTH: Використовуємо другий за пріоритетом ID ${secondNormalized} з джерела ${secondBest.source}`);
                            saveValidatedId(secondNormalized, secondBest.source);
                            return secondNormalized;
                        }
                    }
                } else {
                    console.log(`🔐 AUTH: Знайдено ID ${normalizedId} з джерела ${bestMatch.source}`);
                    saveValidatedId(normalizedId, bestMatch.source);
                    return normalizedId;
                }
            }

            // 9. Як запасний варіант для сторінки налаштувань
            const isSettingsPage = window.location.pathname.includes('general.html');
            if (isSettingsPage) {
                console.warn("🔐 AUTH: Використання тестового ID для сторінки налаштувань");
                const testId = "7066583465";
                saveValidatedId(testId, 'test_fallback');
                return testId;
            }

            console.error("🔐 AUTH: Не вдалося отримати валідний ID користувача з жодного джерела");
            return null;

        } catch (e) {
            console.error("🔐 AUTH: Критична помилка отримання ID з усіх джерел:", e);
            return null;
        }
    }

    /**
     * Зберігає валідований ID у всі доступні сховища
     * @param {string} id - Валідований ID користувача
     * @param {string} source - Джерело ID
     */
    function saveValidatedId(id, source) {
        if (!isValidId(id)) {
            console.error("🔐 AUTH: Спроба зберегти невалідний ID:", id);
            return;
        }

        const normalizedId = normalizeId(id);
        if (!normalizedId) {
            console.error("🔐 AUTH: ID не пройшов нормалізацію:", id);
            return;
        }

        try {
            // Зберігаємо в localStorage
            localStorage.setItem('telegram_user_id', normalizedId);

            // Позначаємо як верифікований, якщо ID з надійного джерела
            if (source === 'telegram' || source === 'api' || source === 'cache' || source === 'jwt' || source === 'jwt_decoded') {
                localStorage.setItem('telegram_user_id_verified', 'true');
            }

            // Зберігаємо в sessionStorage
            sessionStorage.setItem('telegram_user_id', normalizedId);

            // Оновлюємо DOM елемент, якщо він існує
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userIdElement.textContent = normalizedId;
            }

            console.log(`🔐 AUTH: ID користувача ${normalizedId} збережено у всі сховища`);
        } catch (e) {
            console.warn("🔐 AUTH: Помилка збереження ID:", e);
        }
    }

    /**
     * Функція безпечної ініціалізації
     * Спочатку перевіряє наявність API модуля з затримкою
     */
    async function safeInit() {
        try {
            // Перевіряємо наявність API модуля з затримкою для його завантаження
            if (!hasApiModule()) {
                console.warn("🔐 AUTH: API модуль не знайдено, очікуємо 2 секунди...");
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Повторна перевірка
                if (!hasApiModule()) {
                    console.error("🔐 AUTH: API модуль недоступний навіть після очікування");
                    // Створюємо заглушку для API, щоб уникнути помилок
                    window.WinixAPI = window.WinixAPI || {
                        apiRequest: async () => ({ status: 'error', message: 'API недоступний', source: 'stub' }),
                        getUserId: () => getUserIdFromAllSources(),
                        getUserData: async () => ({
                            status: 'success',
                            source: 'stub',
                            data: {
                                telegram_id: getUserIdFromAllSources() || 'unknown',
                                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                                coins: parseInt(localStorage.getItem('userCoins') || '0')
                            }
                        }),
                        refreshToken: async () => {
                            console.log("🔐 AUTH: Заглушка refreshToken викликана");
                            return { status: 'success', source: 'stub' };
                        }
                    };
                }
            }

            // Очищаємо невалідні дані перед ініціалізацією
            cleanInvalidIds();

            // Продовжуємо з init
            return init();
        } catch (error) {
            console.error("🔐 AUTH: Критична помилка при безпечній ініціалізації:", error);
            return Promise.reject(error);
        }
    }

    /**
     * Ініціалізація системи авторизації
     * @returns {Promise<Object>} Об'єкт з даними користувача
     */
    async function init() {
        console.log("🔐 AUTH: Запуск ініціалізації");

        // ВИПРАВЛЕННЯ: Покращена логіка запобігання частим викликам init
        const now = Date.now();
        if ((now - _lastRequestTime) < MIN_REQUEST_INTERVAL) {
            console.log("🔐 AUTH: Часті виклики init, використовуємо кешовані дані");

            // Якщо є кешовані дані користувача, повертаємо їх
            if (window.WinixAuth.currentUser) {
                return Promise.resolve(window.WinixAuth.currentUser);
            }

            // Якщо немає кешованих даних, але виклик занадто частий
            if ((now - _lastRequestTime) < MIN_REQUEST_INTERVAL / 3) {
                const userId = getUserIdFromAllSources();
                return {
                    telegram_id: userId || 'unknown',
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0'),
                    source: 'throttled_init'
                };
            }

            // Інакше дозволяємо продовжити з оновленням часу запиту
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
            console.warn("⚠️ AUTH: Telegram WebApp не знайдено, працюємо в обмеженому режимі");
        }

        // Перевіряємо наявність API модуля
        if (!hasApiModule()) {
            console.error("❌ AUTH: API модуль недоступний");

            // Повертаємо базові дані з localStorage як запасний варіант
            const userId = getUserIdFromAllSources();
            return {
                telegram_id: userId || 'unknown',
                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || '0'),
                source: 'localStorage_fallback'
            };
        }

        // Перевіряємо стан токену авторизації
        const tokenStatus = checkAuthToken();
        console.log("🔐 AUTH: Стан токену:", tokenStatus);

        // Оновлюємо токен, якщо необхідно
        if (!tokenStatus.valid || tokenStatus.expiringSoon ||
            (now - _lastTokenRefreshTime) > MIN_TOKEN_REFRESH_INTERVAL) {
            try {
                console.log('🔄 AUTH: Спроба оновлення токену через WinixAPI');
                if (window.WinixAPI && typeof window.WinixAPI.refreshToken === 'function') {
                    const refreshResult = await window.WinixAPI.refreshToken();

                    if (refreshResult && refreshResult.status === 'success') {
                        console.log('✅ AUTH: Токен успішно оновлено');

                        // Оновлюємо збережений токен, якщо він є у відповіді
                        if (refreshResult.token) {
                            updateAuthToken(refreshResult.token, refreshResult.expires_at);
                        }
                    } else {
                        console.warn('⚠️ AUTH: Проблема з оновленням токену:', refreshResult);
                    }
                } else {
                    console.warn('⚠️ AUTH: Метод refreshToken не доступний');

                    // Якщо refreshToken недоступний, але токен недійсний, спробуємо повну авторизацію
                    if (!tokenStatus.valid) {
                        const tg = window.Telegram?.WebApp;
                        if (tg?.initDataUnsafe?.user) {
                            console.log('🔄 AUTH: Спроба повної авторизації через Telegram дані');
                            const authData = {
                                ...tg.initDataUnsafe.user,
                                initData: tg.initData || ""
                            };

                            const authResult = await authorizeUser(authData);
                            return authResult;
                        }
                    }
                }
            } catch (e) {
                console.warn("⚠️ AUTH: Помилка оновлення токену:", e);
            }
        }

        // Отримуємо дані користувача через getUserData
        try {
            return await getUserData();
        } catch (error) {
            console.warn("⚠️ AUTH: Помилка під час getUserData, спробуємо authorizeUser:", error);

            // Якщо getUserData не спрацював, використовуємо authorizeUser як резервний варіант
            const tg = window.Telegram?.WebApp;
            let authData = {};

            if (tg?.initDataUnsafe?.user) {
                authData = {
                    ...tg.initDataUnsafe.user,
                    initData: tg.initData || ""
                };
            } else {
                // Спроба використати ID з інших джерел
                const userId = getUserIdFromAllSources();
                if (userId) {
                    authData = {
                        id: userId,
                        telegram_id: userId
                    };
                } else {
                    authData = {
                        initData: tg?.initData || ""
                    };
                }
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
            // Клонуємо об'єкт для запобігання його модифікації
            const authData = { ...userData };

            // Оновлюємо ID користувача з усіх можливих джерел
            // Перевіряємо чи доступний Telegram WebApp і оновлюємо дані
            if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
                // Оновлюємо ID користувача з Telegram WebApp
                const telegramId = window.Telegram.WebApp.initDataUnsafe.user.id;
                if (telegramId) {
                    authData.id = String(telegramId);
                    authData.telegram_id = String(telegramId);
                    console.log("🔐 AUTH: ID оновлено з Telegram WebApp:", authData.id);
                }
            }

            // Якщо немає ID в Telegram WebApp, використовуємо інші джерела
            if (!isValidId(authData.id) && !isValidId(authData.telegram_id)) {
                const userId = getUserIdFromAllSources();
                if (userId) {
                    authData.id = userId;
                    authData.telegram_id = userId;
                    console.log("🔐 AUTH: ID оновлено з інших джерел:", userId);
                }
            }

            // Перевірка наявності та валідності ID перед відправкою
            let userId = authData.id || authData.telegram_id || null;

            if (!isValidId(userId)) {
                console.error("❌ AUTH: Неможливо отримати валідний ID користувача для авторизації");
                throw new Error("Неможливо отримати валідний ID користувача");
            }

            // Нормалізуємо ID перед відправкою
            userId = normalizeId(userId);
            if (!userId) {
                console.error("❌ AUTH: ID не пройшов нормалізацію");
                throw new Error("ID не пройшов нормалізацію");
            }

            // Оновлюємо дані запиту з нормалізованим ID
            authData.id = userId;
            authData.telegram_id = userId;

            // Перевірка чи пристрій онлайн
            if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
                throw new Error("Пристрій офлайн");
            }

            // Зберігаємо ID у сховищах
            saveValidatedId(userId, 'auth_request');

            // Показуємо індикатор завантаження, якщо він є
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.add('show');

            // Перевіряємо наявність API модуля
            if (!hasApiModule()) {
                console.error("❌ AUTH: API модуль недоступний");
                if (spinner) spinner.classList.remove('show');

                // Повертаємо базові дані з localStorage як запасний варіант
                return {
                    telegram_id: userId,
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0'),
                    source: 'localStorage_fallback'
                };
            }

            // Виконуємо запит авторизації через WinixAPI
            try {
                console.log("🔐 AUTH: Відправка запиту авторизації з даними:", {...authData, initData: authData.initData ? "..." : undefined});

                const response = await window.WinixAPI.apiRequest('api/auth', 'POST', authData, {
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

                    // Зберігаємо токен авторизації, якщо він є у відповіді
                    if (response.token) {
                        updateAuthToken(response.token, response.expires_at);
                    }

                    // Перевіряємо валідність ID перед збереженням
                    if (isValidId(userData.telegram_id)) {
                        saveValidatedId(userData.telegram_id, 'server_response');
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

                // Повертаємо базові дані з localStorage як запасний варіант
                return {
                    telegram_id: userId,
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0'),
                    source: 'localStorage_fallback'
                };
            }
        } catch (e) {
            console.error("❌ AUTH: Неочікувана помилка в authorizeUser:", e);

            // Повертаємо базові дані з localStorage як запасний варіант
            const userId = getUserIdFromAllSources();
            return {
                telegram_id: userId || 'unknown',
                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || '0'),
                source: 'localStorage_fallback'
            };
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
        // Перевірка чи пристрій онлайн
        if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !forceRefresh) {
            console.warn("🔐 AUTH: Пристрій офлайн, використовуємо кешовані дані");

            // Якщо є кешовані дані, повертаємо їх
            if (window.WinixAuth.currentUser) {
                return Promise.resolve(window.WinixAuth.currentUser);
            }

            // Повертаємо базові дані з localStorage
            const userId = getUserIdFromAllSources();
            return {
                telegram_id: userId || 'unknown',
                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || '0'),
                source: 'localStorage_offline'
            };
        }

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

                // Якщо API недоступний, але є кешовані дані - повертаємо їх
                if (window.WinixAuth.currentUser) {
                    return window.WinixAuth.currentUser;
                }

                // Повертаємо базові дані з localStorage
                return {
                    telegram_id: userId,
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0'),
                    source: 'localStorage_no_api'
                };
            }

            // Перевіряємо авторизаційний токен перед запитом
            const tokenStatus = checkAuthToken();
            if (!tokenStatus.valid) {
                console.warn("🔐 AUTH: Токен недійсний перед getUserData, намагаємося оновити");
                try {
                    if (window.WinixAPI.refreshToken) {
                        const refreshResult = await window.WinixAPI.refreshToken();
                        console.log("🔐 AUTH: Результат оновлення токена:", refreshResult);

                        // Оновлюємо збережений токен, якщо він є у відповіді
                        if (refreshResult?.token) {
                            updateAuthToken(refreshResult.token, refreshResult.expires_at);
                        }
                    }
                } catch (e) {
                    console.warn("🔐 AUTH: Помилка оновлення токена перед getUserData:", e);
                }
            }

            try {
                // Отримуємо дані користувача через WinixAPI
                console.log("🔐 AUTH: Запит getUserData для ID:", userId);
                const response = await window.WinixAPI.getUserData(forceRefresh);

                // Приховуємо індикатор завантаження
                if (spinner) spinner.classList.remove('show');

                if (response && response.status === 'success' && response.data) {
                    // Нормалізуємо отриманий ID
                    if (response.data.telegram_id) {
                        response.data.telegram_id = normalizeId(response.data.telegram_id);
                    }

                    // Зберігаємо дані
                    window.WinixAuth.currentUser = response.data;
                    console.log("✅ AUTH: Дані користувача успішно отримано", response.data);

                    // Якщо є валідний ID, зберігаємо його
                    if (isValidId(response.data.telegram_id)) {
                        saveValidatedId(response.data.telegram_id, 'get_user_data');
                    }

                    // Зберігаємо баланс і жетони в localStorage
                    if (response.data.balance !== undefined) {
                        localStorage.setItem('userTokens', response.data.balance.toString());
                        localStorage.setItem('winix_balance', response.data.balance.toString());
                    }

                    if (response.data.coins !== undefined) {
                        localStorage.setItem('userCoins', response.data.coins.toString());
                        localStorage.setItem('winix_coins', response.data.coins.toString());
                    }

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

                // Якщо помилка пов'язана з токеном, намагаємося виконати повну авторизацію
                if (error.status === 401) {
                    console.warn("🔐 AUTH: Помилка авторизації в getUserData, спробуємо повну авторизацію");

                    // Спробуємо провести повну авторизацію
                    try {
                        // Отримуємо дані з Telegram WebApp
                        const tg = window.Telegram?.WebApp;
                        if (tg?.initDataUnsafe?.user) {
                            const authData = {
                                ...tg.initDataUnsafe.user,
                                initData: tg.initData || ""
                            };

                            console.log("🔐 AUTH: Спроба авторизації через Telegram дані");
                            return await authorizeUser(authData);
                        } else {
                            // Якщо немає даних з Telegram, використовуємо збережений ID
                            const authData = {
                                id: userId,
                                telegram_id: userId
                            };

                            console.log("🔐 AUTH: Спроба авторизації через збережений ID");
                            return await authorizeUser(authData);
                        }
                    } catch (authError) {
                        console.error("❌ AUTH: Невдала спроба повної авторизації:", authError);
                    }
                }

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

                // Повертаємо базові дані з localStorage
                return {
                    telegram_id: userId,
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0'),
                    source: 'localStorage_after_error'
                };
            }
        } catch (e) {
            console.error("❌ AUTH: Неочікувана помилка в getUserData:", e);

            // Якщо є кешовані дані - повертаємо їх
            if (window.WinixAuth.currentUser) {
                return window.WinixAuth.currentUser;
            }

            // Повертаємо базові дані з localStorage
            const userId = getUserIdFromAllSources();
            return {
                telegram_id: userId || 'unknown',
                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || '0'),
                source: 'localStorage_after_critical_error'
            };
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
        try {
            const storedId = localStorage.getItem('telegram_user_id');
            if (storedId && !isValidId(storedId)) {
                console.warn("⚠️ AUTH: Видалення невалідного ID з localStorage:", storedId);
                localStorage.removeItem('telegram_user_id');
                localStorage.removeItem('telegram_user_id_verified');
                cleaned = true;
            }

            // Перевіряємо наявність захардкодженого ID
            if (localStorage.getItem('telegram_user_id') === '12345678') {
                console.warn("⚠️ AUTH: Видалення захардкодженого ID з localStorage");
                localStorage.removeItem('telegram_user_id');
                localStorage.removeItem('telegram_user_id_verified');
                cleaned = true;
            }
        } catch (e) {
            console.warn("⚠️ AUTH: Помилка доступу до localStorage:", e);
        }

        // Перевіряємо ID в sessionStorage
        try {
            const sessionId = sessionStorage.getItem('telegram_user_id');
            if (sessionId && !isValidId(sessionId)) {
                console.warn("⚠️ AUTH: Видалення невалідного ID з sessionStorage:", sessionId);
                sessionStorage.removeItem('telegram_user_id');
                cleaned = true;
            }

            // Перевіряємо наявність захардкодженого ID
            if (sessionStorage.getItem('telegram_user_id') === '12345678') {
                console.warn("⚠️ AUTH: Видалення захардкодженого ID з sessionStorage");
                sessionStorage.removeItem('telegram_user_id');
                cleaned = true;
            }
        } catch (e) {
            console.warn("⚠️ AUTH: Помилка доступу до sessionStorage:", e);
        }

        // Перевіряємо ID в DOM
        try {
            const userIdElement = document.getElementById('user-id');
            if (userIdElement && userIdElement.textContent) {
                const domId = userIdElement.textContent.trim();
                if (!isValidId(domId)) {
                    console.warn("⚠️ AUTH: Видалення невалідного ID з DOM:", domId);
                    userIdElement.textContent = '';
                    cleaned = true;
                }
            }
        } catch (e) {
            console.warn("⚠️ AUTH: Помилка доступу до DOM:", e);
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
                // Перевіряємо чи пристрій онлайн
                if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
                    console.warn("🔐 AUTH: Пристрій офлайн, пропускаємо періодичне оновлення");
                    return;
                }

                if (hasApiModule()) {
                    getUserData()
                        .then(() => console.log("✅ AUTH: Періодичне оновлення даних користувача"))
                        .catch(err => console.warn("⚠️ AUTH: Помилка періодичного оновлення:", err));
                }
            }

            // Перевіряємо стан токену і за потреби оновлюємо
            const tokenStatus = checkAuthToken();
            const now = Date.now();
            if (!tokenStatus.valid || tokenStatus.expiringSoon ||
                (now - _lastTokenRefreshTime) > MIN_TOKEN_REFRESH_INTERVAL) {

                if (hasApiModule() && typeof window.WinixAPI.refreshToken === 'function') {
                    console.log("🔄 AUTH: Періодичне оновлення токену");

                    window.WinixAPI.refreshToken()
                        .then(result => {
                            if (result && result.status === 'success') {
                                console.log("✅ AUTH: Токен успішно оновлено");

                                // Оновлюємо збережений токен, якщо він є у відповіді
                                if (result.token) {
                                    updateAuthToken(result.token, result.expires_at);
                                }
                            } else {
                                console.warn("⚠️ AUTH: Проблема з оновленням токену:", result);
                            }
                        })
                        .catch(err => console.warn("⚠️ AUTH: Помилка оновлення токену:", err));
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
        // Перевіряємо чи пристрій онлайн
        if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
            console.warn("🔐 AUTH: Пристрій офлайн, пропускаємо оновлення даних");

            // Повертаємо кешовані дані, якщо є
            if (window.WinixAuth.currentUser) {
                return window.WinixAuth.currentUser;
            }

            // Повертаємо базові дані з localStorage
            const userId = getUserIdFromAllSources();
            return {
                telegram_id: userId || 'unknown',
                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || '0'),
                source: 'localStorage_offline'
            };
        }

        console.log("🔄 AUTH: Примусове оновлення даних користувача");

        // Перевіряємо стан токену перед запитом
        const tokenStatus = checkAuthToken();
        if (!tokenStatus.valid) {
            console.log("🔄 AUTH: Токен недійсний, спроба оновлення");

            try {
                if (hasApiModule() && typeof window.WinixAPI.refreshToken === 'function') {
                    const refreshResult = await window.WinixAPI.refreshToken();
                    console.log("🔐 AUTH: Результат оновлення токена:", refreshResult);

                    // Оновлюємо збережений токен, якщо він є у відповіді
                    if (refreshResult?.token) {
                        updateAuthToken(refreshResult.token, refreshResult.expires_at);
                    }
                }
            } catch (e) {
                console.warn("⚠️ AUTH: Помилка оновлення токена:", e);
            }
        }

        return getUserData(true);
    }

    /**
     * Отримати токен авторизації
     * @returns {string|null} Токен авторизації або null
     */
    function getAuthToken() {
        try {
            const tokenStatus = checkAuthToken();
            if (tokenStatus.valid) {
                return tokenStatus.token;
            }

            console.warn("⚠️ AUTH: Токен недійсний в getAuthToken");
            return null;
        } catch (e) {
            console.error("❌ AUTH: Помилка отримання токена:", e);
            return null;
        }
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
        normalizeId,

        // Основні методи
        init,
        safeInit,
        authorizeUser,
        getUserData,
        getUserIdFromAllSources,
        refreshUserData,
        cleanInvalidIds,
        clearCache,

        // Методи для роботи з токенами
        checkAuthToken,
        getAuthToken,
        updateAuthToken,

        // Додаткові методи
        saveValidatedId,

        // Методи для показу повідомлень
        showError,
        showWelcomeMessage,
        getLocalizedText,

        // Методи для періодичного оновлення
        startPeriodicUpdate,
        stopPeriodicUpdate,

        // Технічна інформація
        version: '1.2.0'
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
            // Перевіряємо чи пристрій онлайн
            if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
                console.warn("🔐 AUTH: Пристрій офлайн, використовуємо локальні дані");

                // Оновлюємо елемент на сторінці
                const userIdElement = document.getElementById('user-id');
                const userId = getUserIdFromAllSources();
                if (userIdElement && userId) {
                    userIdElement.textContent = userId;
                }

                // Завантажуємо дані з localStorage
                window.WinixAuth.currentUser = {
                    telegram_id: userId || 'unknown',
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0'),
                    source: 'localStorage_offline_init'
                };

                window.WinixAuth.isInitialized = true;
                return;
            }

            // Використовуємо безпечну ініціалізацію з очікуванням API
            safeInit()
                .then(() => {
                    console.log("✅ AUTH: Безпечну ініціалізацію успішно виконано");
                    window.WinixAuth.isInitialized = true;
                })
                .catch(error => {
                    console.warn("⚠️ AUTH: Помилка безпечної ініціалізації:", error);

                    // Відновлюємо дані користувача з localStorage
                    const userId = getUserIdFromAllSources();
                    window.WinixAuth.currentUser = {
                        telegram_id: userId || 'unknown',
                        balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                        coins: parseInt(localStorage.getItem('userCoins') || '0'),
                        source: 'localStorage_init_error'
                    };

                    window.WinixAuth.isInitialized = true;
                });
        } catch (error) {
            console.error("❌ AUTH: Критична помилка автоматичної ініціалізації:", error);

            // Відновлюємо дані користувача з localStorage
            const userId = getUserIdFromAllSources();
            window.WinixAuth.currentUser = {
                telegram_id: userId || 'unknown',
                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || '0'),
                source: 'localStorage_critical_error'
            };
        }
    });

    // Запускаємо авторизацію для веб-аплікацій, які вже завантажилися
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        console.log("🔐 AUTH: Документ вже завантажено, запуск авторизації");

        setTimeout(() => {
            // Спочатку очищаємо невалідні ID
            cleanInvalidIds();

            // Перевіряємо чи пристрій онлайн
            if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
                console.warn("🔐 AUTH: Пристрій офлайн, використовуємо локальні дані при завантаженні");

                // Оновлюємо елемент на сторінці
                const userIdElement = document.getElementById('user-id');
                const userId = getUserIdFromAllSources();
                if (userIdElement && userId) {
                    userIdElement.textContent = userId;
                }

                // Завантажуємо дані з localStorage
                window.WinixAuth.currentUser = {
                    telegram_id: userId || 'unknown',
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0'),
                    source: 'localStorage_offline_load'
                };

                window.WinixAuth.isInitialized = true;
                return;
            }

            // Оновлюємо дані користувача
            getUserData()
                .then(() => {
                    console.log("✅ AUTH: Дані користувача оновлено після завантаження");
                    window.WinixAuth.isInitialized = true;
                })
                .catch(error => {
                    console.warn("⚠️ AUTH: Помилка завантаження даних користувача", error);

                    // Пробуємо виконати повну ініціалізацію
                    safeInit()
                        .then(() => {
                            console.log("✅ AUTH: Повну ініціалізацію успішно виконано");
                            window.WinixAuth.isInitialized = true;
                        })
                        .catch(err => {
                            console.error("❌ AUTH: Критична помилка ініціалізації:", err);

                            // Відновлюємо дані користувача з localStorage
                            const userId = getUserIdFromAllSources();
                            window.WinixAuth.currentUser = {
                                telegram_id: userId || 'unknown',
                                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                                coins: parseInt(localStorage.getItem('userCoins') || '0'),
                                source: 'localStorage_init_error'
                            };
                            window.WinixAuth.isInitialized = true;
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