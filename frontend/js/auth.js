/**
 * auth.js v2.0 - Удосконалений модуль авторизації для WINIX
 *
 * Цей модуль відповідає за:
 * 1. Надійну авторизацію користувача через Telegram WebApp
 * 2. Перевірку підпису даних Telegram
 * 3. Управління сесіями та оновлення токенів
 * 4. Обробку подій авторизації та деавторизації
 */

(function() {
    console.log("🔐 AUTH: Ініціалізація нової системи авторизації");

    // ======== ПРИВАТНІ ЗМІННІ ТА КОНСТАНТИ ========

    // Версія модуля
    const AUTH_VERSION = '2.0';

    // Час сесії та налаштування
    const SESSION_LIFETIME = 24 * 60 * 60 * 1000; // 24 години
    const TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 хвилин
    const SESSION_VALIDATE_INTERVAL = 5 * 60 * 1000; // 5 хвилин

    // Ключі для сховища
    const STORAGE_KEYS = {
        SESSION: 'winix_session',
        AUTH_TOKEN: 'auth_token',
        REFRESH_TOKEN: 'refresh_token',
        USER_ID: 'telegram_user_id',
        USER_DATA: 'user_data',
        LANGUAGE: 'user_language'
    };

    // Прапорці стану
    let _isInitialized = false;
    let _isAuthorizing = false;
    let _debugMode = false;
    let _sessionValidationTimer = null;
    let _tokenRefreshTimer = null;

    // Поточні дані користувача
    let _currentUser = null;

    // Події
    const _events = {
        authSuccess: [],
        authError: [],
        sessionExpired: [],
        tokenRefreshed: [],
        userUpdated: [],
        logout: []
    };

    // Мови інтерфейсу
    const _translations = {
        uk: {
            authError: "Помилка авторизації. Спробуйте перезапустити додаток.",
            dataError: "Помилка отримання даних користувача.",
            welcome: "Вітаємо у WINIX!",
            sessionExpired: "Час сесії вичерпано. Будь ласка, увійдіть знову.",
            tokenError: "Помилка оновлення токена."
        },
        ru: {
            authError: "Ошибка авторизации. Попробуйте перезапустить приложение.",
            dataError: "Ошибка получения данных пользователя.",
            welcome: "Добро пожаловать в WINIX!",
            sessionExpired: "Время сессии истекло. Пожалуйста, войдите снова.",
            tokenError: "Ошибка обновления токена."
        },
        en: {
            authError: "Authorization error. Try restarting the app.",
            dataError: "Error retrieving user data.",
            welcome: "Welcome to WINIX!",
            sessionExpired: "Your session has expired. Please log in again.",
            tokenError: "Error refreshing token."
        }
    };

    // Поточна мова
    let _currentLang = 'uk';

    // ======== ДОПОМІЖНІ ФУНКЦІЇ ========

    /**
     * Отримання перекладеного тексту
     * @param {string} key - Ключ тексту
     * @returns {string} - Перекладений текст
     */
    function getText(key) {
        // Спробуємо отримати текст для поточної мови
        if (_translations[_currentLang] && _translations[_currentLang][key]) {
            return _translations[_currentLang][key];
        }

        // Запасний варіант - українська мова
        return _translations.uk[key] || key;
    }

    /**
     * Генерація унікального ID
     * @returns {string} - Унікальний ID
     */
    function generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Безпечне збереження даних в localStorage
     * @param {string} key - Ключ
     * @param {*} value - Значення
     */
    function safeSetItem(key, value) {
        try {
            // Для об'єктів і масивів використовуємо JSON.stringify
            const valueToStore = typeof value === 'object' && value !== null
                ? JSON.stringify(value)
                : String(value);

            localStorage.setItem(key, valueToStore);
            return true;
        } catch (e) {
            console.error(`Помилка збереження ${key} в localStorage:`, e);
            return false;
        }
    }

    /**
     * Безпечне отримання даних з localStorage
     * @param {string} key - Ключ
     * @param {*} defaultValue - Значення за замовчуванням
     * @param {boolean} parse - Чи потрібно парсити JSON
     * @returns {*} - Отримане значення
     */
    function safeGetItem(key, defaultValue = null, parse = false) {
        try {
            const value = localStorage.getItem(key);

            if (value === null) return defaultValue;

            if (parse) {
                try {
                    return JSON.parse(value);
                } catch {
                    return defaultValue;
                }
            }

            return value;
        } catch (e) {
            console.error(`Помилка отримання ${key} з localStorage:`, e);
            return defaultValue;
        }
    }

    /**
     * Виклик обробників події
     * @param {string} eventName - Назва події
     * @param {*} data - Дані події
     */
    function triggerEvent(eventName, data) {
        if (!_events[eventName]) return;

        _events[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error(`Помилка в обробнику події ${eventName}:`, e);
            }
        });
    }

    /**
     * Оновлення елементів DOM з ID користувача
     * @param {string} userId - ID користувача
     */
    function updateUserIdElements(userId) {
        if (!userId) return;

        try {
            // Спроба використання UserIdManager для оновлення DOM
            if (window.UserIdManager && typeof window.UserIdManager.updateDomElements === 'function') {
                window.UserIdManager.updateDomElements(userId);
                return;
            }

            // Запасний варіант - оновлення DOM вручну
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userIdElement.textContent = userId;
            }

            const userIdValueElements = document.querySelectorAll('.user-id-value');
            userIdValueElements.forEach(element => {
                element.textContent = userId;
            });
        } catch (e) {
            console.error('Помилка оновлення елементів DOM з ID користувача:', e);
        }
    }

    /**
     * Показ повідомлення
     * @param {string} message - Текст повідомлення
     * @param {boolean} isError - Чи є помилкою
     * @param {Function} callback - Функція зворотного виклику
     * @returns {Promise<void>}
     */
    async function showMessage(message, isError = false, callback = null) {
        console.log(`${isError ? "❌" : "✅"} ${message}`);

        // Спочатку намагаємося використати існуючі функції
        if (window.simpleAlert) {
            window.simpleAlert(message, isError, callback);
            return;
        }

        if (window.showToast) {
            window.showToast(message);
            if (callback) setTimeout(callback, 3000);
            return;
        }

        // Вдосконалене повідомлення з кастомним UI замість alert
        const notificationId = 'auth-notification-' + Date.now();

        const notification = document.createElement('div');
        notification.id = notificationId;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-100px);
            background: ${isError ? 'linear-gradient(90deg, #F44336, #E91E63)' : 'linear-gradient(90deg, #4CAF50, #00BFA5)'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            text-align: center;
            max-width: 90%;
            font-weight: 500;
            transition: transform 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Анімуємо появу повідомлення
        setTimeout(() => {
            notification.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);

        // Через 3 секунди приховуємо
        setTimeout(() => {
            notification.style.transform = 'translateX(-50%) translateY(-100px)';

            // Видаляємо з DOM після завершення анімації
            setTimeout(() => {
                if (document.getElementById(notificationId)) {
                    document.body.removeChild(notification);
                }
                if (callback) callback();
            }, 300);
        }, 3000);
    }

    // ======== ФУНКЦІЇ УПРАВЛІННЯ СЕСІЄЮ ========

    /**
     * Створення нової сесії
     * @param {Object} userData - Дані користувача
     * @param {string} token - Токен авторизації
     * @param {string} refreshToken - Токен оновлення
     * @returns {Object} - Об'єкт сесії
     */
    function createSession(userData, token, refreshToken) {
        const sessionId = generateUniqueId();
        const now = Date.now();

        const session = {
            id: sessionId,
            userId: userData.telegram_id || userData.id,
            token: token,
            refreshToken: refreshToken,
            created: now,
            expires: now + SESSION_LIFETIME,
            lastActivity: now
        };

        // Зберігаємо сесію в localStorage
        safeSetItem(STORAGE_KEYS.SESSION, session, true);

        // Зберігаємо токени для зручного доступу
        if (token) safeSetItem(STORAGE_KEYS.AUTH_TOKEN, token);
        if (refreshToken) safeSetItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);

        if (_debugMode) {
            console.log('Створено нову сесію:', {
                id: sessionId,
                userId: session.userId,
                expires: new Date(session.expires).toLocaleString()
            });
        }

        return session;
    }

    /**
     * Оновлення сесії
     * @param {Object} session - Поточна сесія
     * @param {Object} updates - Оновлення для сесії
     * @returns {Object} - Оновлена сесія
     */
    function updateSession(session, updates = {}) {
        if (!session) return null;

        const updatedSession = { ...session, ...updates, lastActivity: Date.now() };

        // Зберігаємо оновлену сесію
        safeSetItem(STORAGE_KEYS.SESSION, updatedSession, true);

        // Оновлюємо токени, якщо вони змінилися
        if (updates.token) safeSetItem(STORAGE_KEYS.AUTH_TOKEN, updates.token);
        if (updates.refreshToken) safeSetItem(STORAGE_KEYS.REFRESH_TOKEN, updates.refreshToken);

        return updatedSession;
    }

    /**
     * Отримання поточної сесії
     * @returns {Object|null} - Поточна сесія або null
     */
    function getCurrentSession() {
        return safeGetItem(STORAGE_KEYS.SESSION, null, true);
    }

    /**
     * Перевірка дійсності сесії
     * @param {Object} session - Сесія для перевірки
     * @returns {boolean} - Чи дійсна сесія
     */
    function isSessionValid(session) {
        if (!session) return false;

        const now = Date.now();
        return session.expires > now;
    }

    /**
     * Видалення сесії
     */
    function clearSession() {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);

        // Зупиняємо таймери
        if (_sessionValidationTimer) {
            clearInterval(_sessionValidationTimer);
            _sessionValidationTimer = null;
        }

        if (_tokenRefreshTimer) {
            clearInterval(_tokenRefreshTimer);
            _tokenRefreshTimer = null;
        }
    }

    /**
     * Оновлення токена
     * @returns {Promise<boolean>} - Результат оновлення
     */
    async function refreshToken() {
        try {
            const session = getCurrentSession();
            if (!session || !session.refreshToken) {
                throw new Error('Відсутній токен оновлення');
            }

            // В реальній системі тут має бути запит до серверу
            // Оскільки WINIX не має окремого API для оновлення токенів,
            // ми використовуємо звичайний запит авторизації

            const refreshResponse = await window.WinixAPI.apiRequest('/api/auth/refresh', 'POST', {
                refresh_token: session.refreshToken,
                telegram_id: session.userId
            });

            if (refreshResponse.status === 'success' && refreshResponse.data && refreshResponse.data.token) {
                // Оновлюємо токени в сесії
                updateSession(session, {
                    token: refreshResponse.data.token,
                    refreshToken: refreshResponse.data.refresh_token || session.refreshToken,
                    expires: Date.now() + SESSION_LIFETIME
                });

                // Викликаємо подію про оновлення токена
                triggerEvent('tokenRefreshed', { userId: session.userId });

                if (_debugMode) {
                    console.log('✅ Токен успішно оновлено');
                }

                return true;
            } else {
                throw new Error(refreshResponse.message || 'Помилка оновлення токена');
            }
        } catch (error) {
            console.error('❌ Помилка оновлення токена:', error);

            // У випадку помилки видаляємо сесію і повідомляємо про необхідність повторної авторизації
            clearSession();
            triggerEvent('sessionExpired', { error });

            return false;
        }
    }

    /**
     * Запуск перевірки сесії
     */
    function startSessionValidation() {
        // Запускаємо таймер перевірки сесії
        _sessionValidationTimer = setInterval(() => {
            const session = getCurrentSession();

            if (!isSessionValid(session)) {
                console.log('⚠️ Сесія застаріла, спроба оновлення токена');

                // Спробуємо оновити токен
                refreshToken().then(success => {
                    if (!success) {
                        // Якщо не вдалося, видаляємо сесію і показуємо повідомлення
                        clearSession();
                        showMessage(getText('sessionExpired'), true);
                        triggerEvent('sessionExpired', { message: 'Час сесії вичерпано' });
                    }
                });
            } else {
                // Оновлюємо час останньої активності
                updateSession(session);
            }
        }, SESSION_VALIDATE_INTERVAL);

        // Запускаємо таймер оновлення токена
        _tokenRefreshTimer = setInterval(() => {
            const session = getCurrentSession();

            if (session) {
                // Оновлюємо токен за 30 хвилин до завершення терміну дії
                const expiryCheck = session.expires - TOKEN_REFRESH_INTERVAL;

                if (Date.now() > expiryCheck) {
                    console.log('⏰ Плановане оновлення токена');
                    refreshToken();
                }
            }
        }, TOKEN_REFRESH_INTERVAL);
    }

    // ======== ФУНКЦІЇ TELEGRAM WEBAPP ========

    /**
     * Перевірка підпису Telegram
     * @param {string} initData - Дані ініціалізації Telegram WebApp
     * @returns {boolean} - Результат перевірки
     */
    function verifyTelegramSignature(initData) {
        // У реальній системі тут має бути повноцінна перевірка підпису
        // з використанням HMAC-SHA-256 і токена бота
        //
        // Оскільки це робиться на сервері, ми лише перевіряємо наявність підпису

        if (!initData) return false;

        // Перевіряємо, чи містить initData параметр hash
        const params = new URLSearchParams(initData);
        return params.has('hash');
    }

    /**
     * Отримання даних з Telegram WebApp
     * @returns {Object|null} - Дані Telegram або null
     */
    function getTelegramWebAppData() {
        // Перевіряємо, чи є Telegram WebApp
        if (!window.Telegram || !window.Telegram.WebApp) {
            console.warn("❓ Telegram WebApp не знайдено");
            return null;
        }

        try {
            // Отримуємо дані з Telegram WebApp
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();

            const initData = tg.initData || "";
            const userData = tg.initDataUnsafe?.user || null;

            if (!userData) {
                console.warn("❓ Не вдалося отримати дані користувача з Telegram WebApp");
                return null;
            }

            // Повертаємо комбіновані дані
            return {
                user: userData,
                initData: initData,
                colorScheme: tg.colorScheme,
                themeParams: tg.themeParams,
                version: tg.version
            };
        } catch (e) {
            console.error("❌ Помилка отримання даних Telegram WebApp:", e);
            return null;
        }
    }

    /**
     * Підготовка даних для відправки на сервер
     * @param {Object} telegramData - Дані Telegram WebApp
     * @returns {Object} - Підготовлені дані
     */
    function prepareAuthData(telegramData) {
        if (!telegramData || !telegramData.user) {
            return { hasError: true, error: 'Відсутні дані користувача' };
        }

        const userData = telegramData.user;

        // Базові дані для авторизації
        const authData = {
            id: userData.id,
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            username: userData.username || '',
            language_code: userData.language_code || 'uk',
            initData: telegramData.initData || '',

            // Додаткові метадані
            app_version: telegramData.version || '',
            color_scheme: telegramData.colorScheme || 'light',
            platform: navigator.platform,
            user_agent: navigator.userAgent
        };

        // Зберігаємо мову користувача
        if (authData.language_code) {
            _currentLang = authData.language_code;
            localStorage.setItem('userLanguage', authData.language_code);
        }

        // Додаємо особливі перевірки для OAuth, якщо потрібно
        if (window.location.search.includes('auth_code=') || window.location.search.includes('state=')) {
            authData.oauth_code = new URLSearchParams(window.location.search).get('auth_code');
            authData.oauth_state = new URLSearchParams(window.location.search).get('state');
        }

        return { hasError: false, data: authData };
    }

    // ======== ОСНОВНІ ФУНКЦІЇ АВТОРИЗАЦІЇ ========

    /**
     * Авторизація користувача
     * @param {Object} userData - Дані користувача з Telegram WebApp
     * @returns {Promise<Object>} - Результат авторизації
     */
    async function authorizeUser(userData) {
        if (_isAuthorizing) {
            console.log("🔐 Авторизація вже виконується");
            return Promise.reject(new Error("Авторизація вже в процесі"));
        }

        _isAuthorizing = true;
        console.log("🔐 Запит авторизації на сервері", userData);

        try {
            // Перевіряємо наявність API модуля
            if (!window.WinixAPI || !window.WinixAPI.authorize) {
                throw new Error("API модуль не знайдено. Перезавантажте сторінку.");
            }

            // Використовуємо API модуль для авторизації
            const authResult = await window.WinixAPI.authorize(userData);

            // Перевірка успішності авторизації
            if (authResult.status !== 'success' || !authResult.data) {
                throw new Error(authResult.message || "Помилка авторизації на сервері");
            }

            // Отримуємо дані користувача
            const user = authResult.data;

            // Зберігаємо дані користувача
            _currentUser = user;
            safeSetItem(STORAGE_KEYS.USER_DATA, user, true);

            // Отримуємо токени з відповіді (якщо є)
            const token = user.token || authResult.token || null;
            const refreshToken = user.refresh_token || authResult.refresh_token || null;

            // Створюємо нову сесію
            if (token) {
                createSession(user, token, refreshToken);
                startSessionValidation();
            }

            // Зберігаємо ID користувача для інших частин додатку
            if (user.telegram_id) {
                safeSetItem(STORAGE_KEYS.USER_ID, user.telegram_id);

                // Оновлюємо всі елементи DOM з ID
                updateUserIdElements(user.telegram_id);

                // Якщо є UserIdManager, використовуємо його
                if (window.UserIdManager && typeof window.UserIdManager.setUserId === 'function') {
                    window.UserIdManager.setUserId(user.telegram_id);
                }
            }

            // Зберігаємо додаткові дані користувача
            if (user.language_code) {
                _currentLang = user.language_code;
                safeSetItem(STORAGE_KEYS.LANGUAGE, user.language_code);
            }

            // Показуємо вітальне повідомлення для нових користувачів
            if (authResult.data.is_new_user) {
                showMessage(getText('welcome'), false);
            }

            // Викликаємо подію про успішну авторизацію
            triggerEvent('authSuccess', user);

            // Запускаємо синхронізацію даних користувача
            syncUserData();

            _isAuthorizing = false;
            return user;
        } catch (error) {
            _isAuthorizing = false;

            // Детальне логування помилки
            console.error("❌ Помилка авторизації:", error);

            // Додаткова діагностична інформація
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                console.error("❌ Проблема мережевого з'єднання - сервер недоступний");
            } else if (error.status || error.statusText) {
                console.error(`❌ HTTP помилка (${error.status}): ${error.statusText}`);
            }

            // Показуємо повідомлення про помилку
            await showMessage(getText('authError'), true);

            // Викликаємо подію про помилку авторизації
            triggerEvent('authError', error);

            throw error;
        }
    }

    /**
     * Виконання виходу з системи
     * @returns {Promise<boolean>} - Результат виходу
     */
    async function logout() {
        try {
            // Викликаємо API для виходу (якщо є)
            if (window.WinixAPI && window.WinixAPI.apiRequest) {
                try {
                    await window.WinixAPI.apiRequest('/api/auth/logout', 'POST');
                } catch (e) {
                    console.warn('Помилка виклику API для виходу:', e);
                }
            }

            // Очищаємо дані сесії
            clearSession();

            // Очищаємо дані користувача
            _currentUser = null;
            localStorage.removeItem(STORAGE_KEYS.USER_DATA);

            // Викликаємо подію про вихід
            triggerEvent('logout', {});

            return true;
        } catch (e) {
            console.error('Помилка при виході з системи:', e);
            return false;
        }
    }

    /**
     * Синхронізація даних користувача з сервера
     * @returns {Promise<Object|null>} - Дані користувача або null
     */
    async function syncUserData() {
        try {
            // Перевіряємо наявність ID користувача
            const userId = getCurrentUserId();
            if (!userId) {
                console.warn('Неможливо синхронізувати дані користувача: ID не знайдено');
                return null;
            }

            // Використовуємо API модуль для отримання даних користувача
            if (window.WinixAPI && window.WinixAPI.getUserData) {
                const userData = await window.WinixAPI.getUserData(userId);

                if (userData.status === 'success' && userData.data) {
                    // Оновлюємо дані користувача
                    _currentUser = userData.data;
                    safeSetItem(STORAGE_KEYS.USER_DATA, userData.data, true);

                    // Викликаємо подію про оновлення даних користувача
                    triggerEvent('userUpdated', userData.data);

                    return userData.data;
                }
            }

            return null;
        } catch (e) {
            console.error('Помилка синхронізації даних користувача:', e);
            return null;
        }
    }

    /**
     * Перевірка, чи користувач авторизований
     * @returns {boolean} - Результат перевірки
     */
    function isUserAuthorized() {
        const session = getCurrentSession();
        return isSessionValid(session);
    }

    /**
     * Отримання ID поточного користувача
     * @returns {string|null} - ID користувача або null
     */
    function getCurrentUserId() {
        // Спочатку перевіряємо поточного користувача
        if (_currentUser && _currentUser.telegram_id) {
            return _currentUser.telegram_id;
        }

        // Потім перевіряємо сесію
        const session = getCurrentSession();
        if (session && session.userId) {
            return session.userId;
        }

        // Нарешті, перевіряємо localStorage
        return safeGetItem(STORAGE_KEYS.USER_ID);
    }

    /**
     * Отримання даних поточного користувача
     * @returns {Object|null} - Дані користувача або null
     */
    function getCurrentUser() {
        if (_currentUser) {
            return { ..._currentUser };
        }

        // Спроба отримати з localStorage
        const storedUser = safeGetItem(STORAGE_KEYS.USER_DATA, null, true);
        if (storedUser) {
            _currentUser = storedUser;
            return { ...storedUser };
        }

        return null;
    }

    /**
     * Отримання токена авторизації
     * @returns {string|null} - Токен авторизації або null
     */
    function getAuthToken() {
        // Спочатку перевіряємо сесію
        const session = getCurrentSession();
        if (session && session.token) {
            return session.token;
        }

        // Потім перевіряємо localStorage
        return safeGetItem(STORAGE_KEYS.AUTH_TOKEN);
    }

    // ======== ІНІЦІАЛІЗАЦІЯ МОДУЛЯ ========

    /**
     * Ініціалізація системи авторизації
     * @param {Object} config - Конфігурація
     * @returns {Promise<Object|null>} - Результат ініціалізації
     */
    async function init(config = {}) {
        try {
            console.log("🔐 Запуск ініціалізації системи авторизації");

            if (_isInitialized) {
                console.log("🔐 Система вже ініціалізована");
                return _currentUser;
            }

            // Застосовуємо конфігурацію
            if (config.debug !== undefined) _debugMode = config.debug;
            if (config.language) _currentLang = config.language;

            // Встановлюємо прапорець ініціалізації
            _isInitialized = true;

            // Отримуємо поточну мову з localStorage
            const storedLang = safeGetItem(STORAGE_KEYS.LANGUAGE);
            if (storedLang) {
                _currentLang = storedLang;
            }

            // Перевіряємо, чи є активна сесія
            const session = getCurrentSession();
            if (isSessionValid(session)) {
                // Сесія дійсна, отримуємо дані користувача
                console.log("🔐 Виявлено активну сесію, отримання даних користувача");

                // Оновлюємо час останньої активності
                updateSession(session);

                // Запускаємо перевірку сесії
                startSessionValidation();

                // Отримуємо дані користувача з localStorage
                const storedUser = safeGetItem(STORAGE_KEYS.USER_DATA, null, true);
                if (storedUser) {
                    _currentUser = storedUser;

                    // Оновлюємо елементи DOM з ID користувача
                    if (storedUser.telegram_id) {
                        updateUserIdElements(storedUser.telegram_id);
                    }

                    // Синхронізуємо дані користувача з сервера
                    syncUserData().catch(error => {
                        console.warn('Помилка синхронізації даних користувача:', error);
                    });

                    return _currentUser;
                }

                // Якщо немає локальних даних, але є сесія,
                // синхронізуємо дані з сервера
                try {
                    const userData = await syncUserData();
                    if (userData) {
                        return userData;
                    }
                } catch (e) {
                    console.warn('Помилка синхронізації даних користувача:', e);
                }
            }

            // Якщо немає активної сесії або не вдалося отримати дані,
            // спробуємо авторизуватися через Telegram WebApp
            const telegramData = getTelegramWebAppData();
            if (telegramData) {
                // Підготовка даних для авторизації
                const authDataResult = prepareAuthData(telegramData);

                if (!authDataResult.hasError) {
                    // Авторизація користувача
                    console.log("🔐 Виконання авторизації через Telegram WebApp");
                    return await authorizeUser(authDataResult.data);
                } else {
                    console.warn("❌ Помилка підготовки даних авторизації:", authDataResult.error);
                }
            }

            console.warn("⚠️ Не вдалося авторизувати користувача при ініціалізації");
            return null;
        } catch (e) {
            console.error("❌ Помилка ініціалізації системи авторизації:", e);
            return null;
        }
    }

    /**
     * Додавання обробника події
     * @param {string} eventName - Назва події
     * @param {Function} callback - Функція-обробник
     */
    function on(eventName, callback) {
        if (!_events[eventName]) {
            console.warn(`Подія "${eventName}" не підтримується`);
            return;
        }

        _events[eventName].push(callback);
    }

    /**
     * Видалення обробника події
     * @param {string} eventName - Назва події
     * @param {Function} callback - Функція-обробник
     */
    function off(eventName, callback) {
        if (!_events[eventName]) return;

        _events[eventName] = _events[eventName].filter(cb => cb !== callback);
    }

    // ======== ЕКСПОРТ ПУБЛІЧНОГО API ========

    // Створюємо публічний API модуля
    window.WinixAuth = {
        // Основні властивості
        VERSION: AUTH_VERSION,
        isInitialized: () => _isInitialized,

        // Поточні дані
        currentUser: null, // Буде встановлено властивістю нижче

        // Мови і переклади
        lang: _translations,

        // Ініціалізація
        init,

        // Авторизація і сесія
        authorizeUser,
        logout,
        isUserAuthorized,
        getAuthToken,
        getCurrentUser,
        getCurrentUserId,

        // Управління подіями
        on,
        off,

        // Допоміжні функції
        syncUserData,
        showMessage,
        getText,

        // Методи для використання в інших модулях
        updateUserIdElements
    };

    // Встановлюємо getter для currentUser для отримання актуальних даних
    Object.defineProperty(window.WinixAuth, 'currentUser', {
        get: function() {
            return getCurrentUser();
        },
        enumerable: true,
        configurable: true
    });

    // ======== АВТОМАТИЧНА ІНІЦІАЛІЗАЦІЯ ========

    // Автоматична ініціалізація при завантаженні DOM
    document.addEventListener('DOMContentLoaded', function() {
        console.log("🔐 DOMContentLoaded, автоматична ініціалізація");

        // Ініціалізуємо модуль
        init().then(user => {
            if (user) {
                console.log("✅ Авторизація виконана успішно при завантаженні DOM");

                // Викликаємо подію про успішну авторизацію
                document.dispatchEvent(new CustomEvent('auth-success', {
                    detail: user
                }));
            } else {
                console.warn("⚠️ Не вдалося авторизувати користувача при завантаженні DOM");

                // Викликаємо подію про помилку авторизації
                document.dispatchEvent(new CustomEvent('auth-error', {
                    detail: { message: 'Не вдалося авторизувати користувача' }
                }));
            }
        }).catch(error => {
            console.error("❌ Помилка ініціалізації:", error);

            // Викликаємо подію про помилку авторизації
            document.dispatchEvent(new CustomEvent('auth-error', {
                detail: error
            }));
        });
    });

    // Якщо DOM вже готовий, ініціалізуємо модуль зараз
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        console.log("🔐 Документ вже завантажено, запуск ініціалізації");

        setTimeout(() => {
            init().then(user => {
                if (user) {
                    console.log("✅ Авторизація виконана успішно (відкладений запуск)");
                } else {
                    console.warn("⚠️ Не вдалося авторизувати користувача (відкладений запуск)");
                }
            }).catch(error => {
                console.error("❌ Помилка відкладеної ініціалізації:", error);
            });
        }, 100);
    }

    // Обробник події Telegram WebApp
    document.addEventListener('telegram-ready', function() {
        console.log("🔐 Отримано подію telegram-ready, запуск авторизації");

        // Отримуємо дані від Telegram
        const telegramData = getTelegramWebAppData();
        if (telegramData) {
            // Підготовка даних для авторизації
            const authDataResult = prepareAuthData(telegramData);

            if (!authDataResult.hasError) {
                // Авторизація користувача
                authorizeUser(authDataResult.data).catch(error => {
                    console.error("❌ Помилка авторизації після telegram-ready:", error);
                });
            } else {
                console.warn("❌ Помилка підготовки даних авторизації:", authDataResult.error);
            }
        } else {
            console.warn("❌ Не вдалося отримати дані Telegram WebApp");
        }
    });

    // Обробник помилок Fetch API для автоматичного оновлення токена
    const originalFetch = window.fetch;
    window.fetch = async function(resource, options = {}) {
        try {
            // Виконуємо оригінальний запит
            const response = await originalFetch(resource, options);

            // Перевіряємо статус відповіді
            if (response.status === 401 || response.status === 403) {
                // Отримуємо поточну сесію
                const session = getCurrentSession();

                // Якщо є сесія, спробуємо оновити токен
                if (session) {
                    const refreshed = await refreshToken();

                    if (refreshed) {
                        // Отримуємо оновлену сесію
                        const updatedSession = getCurrentSession();

                        // Повторюємо запит з новим токеном
                        const newOptions = { ...options };

                        // Оновлюємо заголовок Authorization, якщо він використовується
                        if (updatedSession && updatedSession.token) {
                            if (!newOptions.headers) newOptions.headers = {};
                            newOptions.headers['Authorization'] = `Bearer ${updatedSession.token}`;
                        }

                        // Повторюємо запит
                        return originalFetch(resource, newOptions);
                    }
                }
            }

            return response;
        } catch (error) {
            // Якщо помилка пов'язана з мережею, можна спробувати повторити запит
            // або провести інші дії з відновлення
            throw error;
        }
    };

    console.log("✅ Систему авторизації успішно завантажено");
})();