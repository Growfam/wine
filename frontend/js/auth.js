/**
 * auth.js - Модуль авторизації для Telegram Mini App
 * ВИПРАВЛЕНА ВЕРСІЯ БЕЗ undefined проблем та fallback плутанини
 * @version 4.0.0
 */

(function() {
    'use strict';

    console.log("🔐 AUTH: Ініціалізація ВИПРАВЛЕНОЇ системи авторизації");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Флаги для контролю запитів
    let _authRequestInProgress = false;
    let _userDataRequestInProgress = false;
    let _lastRequestTime = 0;
    let _initializationInProgress = false;

    // Мінімальний інтервал між запитами
    const MIN_REQUEST_INTERVAL = 5000; // 5 секунд

    // Підтримка подій
    const EVENT_USER_DATA_UPDATED = 'user-data-updated';
    const EVENT_AUTH_SUCCESS = 'auth-success';
    const EVENT_AUTH_ERROR = 'auth-error';

    // Кешовані дані
    let _currentUser = null;
    let _telegramReady = false;

    // ======== ФУНКЦІЇ TELEGRAM WEBAPP ========

    /**
     * КРИТИЧНО ВАЖЛИВА функція - чекання готовності Telegram WebApp
     */
    function waitForTelegramReady(timeout = 10000) {
        return new Promise((resolve) => {
            console.log("⏳ AUTH: Очікування готовності Telegram WebApp...");

            const startTime = Date.now();

            function checkTelegram() {
                // Перевіряємо всі необхідні об'єкти Telegram WebApp
                if (window.Telegram &&
                    window.Telegram.WebApp &&
                    window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user &&
                    window.Telegram.WebApp.initDataUnsafe.user.id) {

                    _telegramReady = true;
                    console.log("✅ AUTH: Telegram WebApp готовий");
                    resolve(true);
                    return;
                }

                // Перевіряємо timeout
                if (Date.now() - startTime > timeout) {
                    console.warn("⚠️ AUTH: Timeout очікування Telegram WebApp");
                    resolve(false);
                    return;
                }

                // Продовжуємо перевірку
                setTimeout(checkTelegram, 100);
            }

            checkTelegram();
        });
    }

    /**
     * ВИПРАВЛЕНА функція отримання Telegram User ID
     */
    function getTelegramUserId() {
        try {
            // Функція валідації ID
            function isValidId(id) {
                if (!id) return false;
                if (typeof id === 'function') return false;
                if (id === 'undefined' || id === 'null') return false;

                const idStr = String(id).trim();
                if (!idStr || idStr === 'undefined' || idStr === 'null') return false;

                const idNum = parseInt(idStr);
                if (isNaN(idNum) || idNum <= 0) return false;

                return true;
            }

            // 1. Пріоритет: Telegram WebApp
            if (_telegramReady && window.Telegram && window.Telegram.WebApp) {
                console.log("🔍 AUTH: Перевірка Telegram WebApp...");

                try {
                    if (window.Telegram.WebApp.initDataUnsafe &&
                        window.Telegram.WebApp.initDataUnsafe.user &&
                        window.Telegram.WebApp.initDataUnsafe.user.id) {

                        const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
                        console.log(`🔍 AUTH: Telegram WebApp ID: ${tgUserId}`);

                        if (isValidId(tgUserId)) {
                            const validId = String(tgUserId);
                            console.log(`✅ AUTH: Валідний ID з Telegram: ${validId}`);

                            // Зберігаємо в localStorage
                            try {
                                localStorage.setItem('telegram_user_id', validId);
                            } catch (e) {}

                            return validId;
                        }
                    }
                } catch (e) {
                    console.warn("⚠️ AUTH: Помилка отримання ID з Telegram WebApp:", e);
                }
            }

            // 2. localStorage (fallback)
            try {
                const localId = localStorage.getItem('telegram_user_id');
                if (isValidId(localId)) {
                    console.log(`💾 AUTH: ID з localStorage: ${localId}`);
                    return String(localId);
                }
            } catch (e) {
                console.warn("⚠️ AUTH: Помилка читання localStorage:", e);
            }

            // ID не знайдено
            console.warn("⚠️ AUTH: Валідний Telegram ID не знайдено");
            return null;

        } catch (e) {
            console.error("💥 AUTH: Критична помилка отримання ID користувача:", e);
            return null;
        }
    }

    /**
     * Перевірка наявності API модуля
     */
    function hasApiModule() {
        try {
            return window.WinixAPI &&
                   typeof window.WinixAPI.apiRequest === 'function' &&
                   typeof window.WinixAPI.getUserId === 'function';
        } catch (e) {
            console.error("🔐 AUTH: Помилка перевірки API модуля:", e);
            return false;
        }
    }

    /**
     * Показати повідомлення про помилку
     */
    function showError(message, type = 'error') {
        console.error("❌ AUTH: " + message);

        if (window.showToast) {
            window.showToast(message, type);
            return;
        }

        // Fallback alert тільки для критичних помилок
        if (type === 'error') {
            console.error("КРИТИЧНА ПОМИЛКА AUTH:", message);
        }
    }

    // ======== ФУНКЦІЇ АВТОРИЗАЦІЇ ========

    /**
     * ВИПРАВЛЕНА авторизація користувача на сервері
     */
    async function authorizeUser(userData) {
        if (_authRequestInProgress) {
            console.log("🔐 AUTH: Авторизація вже виконується");
            return _currentUser || {};
        }

        _authRequestInProgress = true;

        try {
            // Обов'язково отримуємо ID користувача
            const telegramId = getTelegramUserId();
            if (!telegramId) {
                throw new Error("Telegram ID не знайдено. Переконайтеся, що додаток запущено через Telegram.");
            }

            console.log(`🔐 AUTH: Початок авторизації користувача ${telegramId}`);

            // Оновлюємо userData з актуальним ID
            userData = {
                ...userData,
                id: telegramId,
                telegram_id: telegramId
            };

            // Перевіряємо наявність API модуля
            if (!hasApiModule()) {
                throw new Error("API модуль недоступний");
            }

            // Показуємо індикатор завантаження
            if (typeof window.showLoading === 'function') {
                window.showLoading();
            }

            // Виконуємо запит авторизації
            const response = await window.WinixAPI.apiRequest('api/auth', 'POST', userData, {
                timeout: 15000
            });

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            if (response && response.status === 'success' && response.data) {
                // Зберігаємо дані користувача
                _currentUser = response.data;
                console.log("✅ AUTH: Користувача успішно авторизовано", response.data);

                // Показуємо вітальне повідомлення для нових користувачів
                if (response.data.is_new_user) {
                    if (window.showToast) {
                        window.showToast('Вітаємо у WINIX!', 'success');
                    }
                }

                // Відправляємо подію про успішну авторизацію
                document.dispatchEvent(new CustomEvent(EVENT_AUTH_SUCCESS, {
                    detail: response.data
                }));

                return response.data;
            } else {
                throw new Error(response?.message || "Помилка авторизації на сервері");
            }

        } catch (error) {
            console.error("❌ AUTH: Помилка авторизації:", error);

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            // Відправляємо подію про помилку
            document.dispatchEvent(new CustomEvent(EVENT_AUTH_ERROR, {
                detail: { error: error.message }
            }));

            // Показуємо повідомлення користувачу
            showError(error.message || 'Помилка авторизації', 'error');

            throw error;

        } finally {
            _authRequestInProgress = false;
        }
    }

    /**
     * ВИПРАВЛЕНЕ отримання даних користувача з сервера
     */
    async function getUserData(forceRefresh = false) {
        // Обов'язково отримуємо ID користувача
        const telegramId = getTelegramUserId();
        if (!telegramId) {
            throw new Error("Telegram ID не знайдено");
        }

        // Запобігання паралельним запитам
        if (_userDataRequestInProgress && !forceRefresh) {
            console.log("🔐 AUTH: Запит даних користувача вже виконується");
            return _currentUser || {};
        }

        // Запобігання частим запитам
        const now = Date.now();
        const timeSinceLastRequest = now - _lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && !forceRefresh) {
            console.log(`🔐 AUTH: Занадто частий запит даних користувача`);
            return _currentUser || {};
        }

        _lastRequestTime = now;
        _userDataRequestInProgress = true;

        try {
            console.log(`🔐 AUTH: Отримання даних користувача ${telegramId}`);

            // Перевіряємо наявність API модуля
            if (!hasApiModule()) {
                throw new Error("API модуль недоступний");
            }

            // Показуємо індикатор завантаження
            if (typeof window.showLoading === 'function') {
                window.showLoading();
            }

            // Отримуємо дані користувача
            const response = await window.WinixAPI.getUserData(forceRefresh);

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            if (response && response.status === 'success' && response.data) {
                // Зберігаємо дані
                _currentUser = response.data;
                console.log("✅ AUTH: Дані користувача успішно отримано", response.data);

                // Відправляємо подію оновлення даних
                document.dispatchEvent(new CustomEvent(EVENT_USER_DATA_UPDATED, {
                    detail: response.data
                }));

                return response.data;
            } else {
                throw new Error(response?.message || "Помилка отримання даних користувача");
            }

        } catch (error) {
            console.error("❌ AUTH: Помилка отримання даних користувача:", error);

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            throw error;

        } finally {
            _userDataRequestInProgress = false;
        }
    }

    /**
     * ВИПРАВЛЕНА ініціалізація системи авторизації
     */
    async function init() {
        if (_initializationInProgress) {
            console.log("🔐 AUTH: Ініціалізація вже виконується");
            return _currentUser;
        }

        _initializationInProgress = true;

        try {
            console.log("🔐 AUTH: Початок ВИПРАВЛЕНОЇ ініціалізації");

            // 1. Чекаємо готовності Telegram WebApp
            console.log("⏳ AUTH: Очікування Telegram WebApp...");
            const telegramReady = await waitForTelegramReady();

            if (!telegramReady) {
                throw new Error("Telegram WebApp не готовий. Переконайтеся, що додаток запущено через Telegram.");
            }

            // 2. Чекаємо готовності API модуля
            console.log("⏳ AUTH: Очікування API модуля...");
            let apiWaitAttempts = 0;
            const maxApiWaitAttempts = 20; // 10 секунд

            while (!hasApiModule() && apiWaitAttempts < maxApiWaitAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                apiWaitAttempts++;
            }

            if (!hasApiModule()) {
                throw new Error("API модуль недоступний");
            }

            console.log("✅ AUTH: API модуль готовий");

            // 3. Ініціалізуємо Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp) {
                try {
                    window.Telegram.WebApp.ready();
                    window.Telegram.WebApp.expand();
                    console.log("✅ AUTH: Telegram WebApp ініціалізовано");
                } catch (e) {
                    console.warn("⚠️ AUTH: Помилка ініціалізації Telegram WebApp:", e);
                }
            }

            // 4. Отримуємо ID користувача
            const telegramId = getTelegramUserId();
            if (!telegramId) {
                throw new Error("Не вдалося отримати Telegram ID користувача");
            }

            console.log(`✅ AUTH: Telegram ID отримано: ${telegramId}`);

            // 5. Оновлюємо елемент на сторінці
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userIdElement.textContent = telegramId;
            }

            // 6. Отримуємо дані користувача
            try {
                const userData = await getUserData();
                console.log("✅ AUTH: Ініціалізація завершена успішно");
                return userData;
            } catch (error) {
                console.warn("⚠️ AUTH: Не вдалося отримати дані користувача, але ініціалізація продовжується:", error);
                // Повертаємо базовий об'єкт користувача
                return {
                    telegram_id: telegramId,
                    username: `User_${telegramId.slice(-4)}`,
                    balance: 0,
                    coins: 0
                };
            }

        } catch (error) {
            console.error("❌ AUTH: Критична помилка ініціалізації:", error);
            showError(error.message || 'Помилка ініціалізації системи авторизації', 'error');
            throw error;

        } finally {
            _initializationInProgress = false;
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
     * Очищення кешу даних
     */
    function clearCache() {
        console.log("🧹 AUTH: Очищення кешу даних");
        _currentUser = null;
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
        telegramReady: false,

        // Основні методи
        init,
        authorizeUser,
        getUserData,
        getTelegramUserId,
        refreshUserData,
        clearCache,

        // Методи для показу повідомлень
        showError,

        // Технічна інформація
        version: '4.0.0',

        // Геттери для стану
        get isReady() {
            return _telegramReady && hasApiModule();
        },

        get currentUserId() {
            return getTelegramUserId();
        }
    };

    // ======== АВТОМАТИЧНА ІНІЦІАЛІЗАЦІЯ ========

    // Функція автоматичної ініціалізації
    async function autoInit() {
        try {
            console.log("🔐 AUTH: Автоматична ініціалізація");

            const userData = await init();
            window.WinixAuth.currentUser = userData;
            window.WinixAuth.isInitialized = true;
            window.WinixAuth.telegramReady = _telegramReady;

            console.log("✅ AUTH: Автоматична ініціалізація завершена успішно");
        } catch (error) {
            console.error("❌ AUTH: Помилка автоматичної ініціалізації:", error);
            window.WinixAuth.isInitialized = false;
        }
    }

    // Запускаємо ініціалізацію залежно від стану DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        // Документ вже завантажений, запускаємо з невеликою затримкою
        setTimeout(autoInit, 100);
    }

    console.log("✅ AUTH: ВИПРАВЛЕНУ систему авторизації успішно завантажено");
})();