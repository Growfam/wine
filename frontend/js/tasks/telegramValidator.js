/**
 * Модуль валідації Telegram даних для системи WINIX - Production Version
 * Перевірка автентичності Telegram WebApp даних без заглушок
 */

window.TelegramValidator = (function() {
    'use strict';

    console.log('🔐 [TelegramValidator] ===== ІНІЦІАЛІЗАЦІЯ МОДУЛЯ ВАЛІДАЦІЇ TELEGRAM (PRODUCTION) =====');

    // Стан модуля
    const moduleState = {
        isInitialized: false,
        apiAvailable: false,
        lastApiCheck: 0,
        retryCount: 0,
        maxRetries: 3
    };

    /**
     * Перевірка доступності API перед валідацією
     */
    async function checkApiAvailability() {
        console.log('🔍 [TelegramValidator] Перевірка доступності API...');

        const now = Date.now();
        // Кешуємо результат на 30 секунд
        if (moduleState.apiAvailable && (now - moduleState.lastApiCheck) < 30000) {
            console.log('✅ [TelegramValidator] API доступний (кеш)');
            return true;
        }

        try {
            // Простий ping до API
            const response = await fetch('/api/ping', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });

            moduleState.apiAvailable = response.ok;
            moduleState.lastApiCheck = now;
            moduleState.retryCount = 0;

            console.log(`${moduleState.apiAvailable ? '✅' : '❌'} [TelegramValidator] API статус:`, response.status);
            return moduleState.apiAvailable;

        } catch (error) {
            console.error('❌ [TelegramValidator] API недоступний:', error.message);
            moduleState.apiAvailable = false;
            moduleState.lastApiCheck = now;
            return false;
        }
    }

    /**
     * Строга перевірка наявності Telegram WebApp
     */
    function checkTelegramAvailability() {
        console.log('🔍 [TelegramValidator] Перевірка доступності Telegram WebApp...');

        if (!window.Telegram?.WebApp) {
            console.error('❌ [TelegramValidator] Telegram WebApp не знайдено');
            throw new Error('Додаток повинен бути відкритий через Telegram');
        }

        const webApp = window.Telegram.WebApp;

        if (!webApp.initData) {
            console.error('❌ [TelegramValidator] Telegram initData відсутні');
            throw new Error('Невірні дані Telegram WebApp');
        }

        if (!webApp.initDataUnsafe) {
            console.error('❌ [TelegramValidator] Telegram initDataUnsafe відсутні');
            throw new Error('Дані користувача недоступні');
        }

        console.log('✅ [TelegramValidator] Telegram WebApp доступний');
        return true;
    }

    /**
     * Отримати та валідувати Telegram дані
     */
    function getTelegramData() {
        console.log('📱 [TelegramValidator] Отримання Telegram даних...');

        // Строга перевірка доступності
        checkTelegramAvailability();

        const webApp = window.Telegram.WebApp;
        const initData = webApp.initData;
        const initDataUnsafe = webApp.initDataUnsafe;

        console.log('🔍 [TelegramValidator] WebApp version:', webApp.version);
        console.log('🔍 [TelegramValidator] WebApp platform:', webApp.platform);
        console.log('🔍 [TelegramValidator] InitData length:', initData.length);

        // Перевіряємо наявність користувача
        if (!initDataUnsafe.user) {
            console.error('❌ [TelegramValidator] Дані користувача відсутні');
            throw new Error('Дані користувача недоступні');
        }

        // Перевіряємо обов'язкові поля користувача
        const user = initDataUnsafe.user;
        if (!user.id || typeof user.id !== 'number') {
            console.error('❌ [TelegramValidator] Невірний ID користувача');
            throw new Error('Невірний ID користувача');
        }

        console.log('✅ [TelegramValidator] Telegram дані валідні');
        console.log('👤 [TelegramValidator] Користувач ID:', user.id);
        console.log('👤 [TelegramValidator] Username:', user.username || 'Не вказано');

        return {
            initData: initData,
            initDataUnsafe: initDataUnsafe,
            user: user,
            auth_date: initDataUnsafe.auth_date || null,
            hash: initDataUnsafe.hash || null,
            chat_instance: initDataUnsafe.chat_instance || null,
            chat_type: initDataUnsafe.chat_type || null,
            start_param: initDataUnsafe.start_param || null
        };
    }

    /**
     * Валідація Telegram користувача локально
     */
    function validateUserLocally(userData) {
        console.log('🔍 [TelegramValidator] Локальна валідація користувача...');

        if (!userData) {
            throw new Error('Дані користувача відсутні');
        }

        // Перевіряємо обов'язкові поля
        if (!userData.id || typeof userData.id !== 'number' || userData.id <= 0) {
            throw new Error('Невірний ID користувача');
        }

        // Перевіряємо довжину username якщо є
        if (userData.username && (userData.username.length < 5 || userData.username.length > 32)) {
            console.warn('⚠️ [TelegramValidator] Підозрілий username:', userData.username);
        }

        // Перевіряємо давність auth_date якщо є
        const authDate = parseInt(userData.auth_date || 0);
        if (authDate) {
            const currentTime = Math.floor(Date.now() / 1000);
            const maxAge = 86400; // 24 години
            const age = currentTime - authDate;

            console.log('⏰ [TelegramValidator] Вік даних:', age, 'секунд');

            if (age > maxAge) {
                throw new Error('Дані застарілі. Оновіть сторінку');
            }

            if (age < 0) {
                throw new Error('Невірна мітка часу авторизації');
            }
        }

        // Перевіряємо валідність ID за діапазоном
        const validation = window.TasksConstants?.VALIDATION_RULES?.TELEGRAM_ID;
        if (validation) {
            if (userData.id < validation.MIN || userData.id > validation.MAX) {
                throw new Error('Невірний діапазон ID користувача');
            }
        }

        console.log('✅ [TelegramValidator] Локальна валідація пройдена');
        return true;
    }

    /**
     * Валідація даних на сервері
     */
    async function validateOnServer(telegramData) {
        console.log('🌐 [TelegramValidator] === СЕРВЕРНА ВАЛІДАЦІЯ ===');

        if (!telegramData || !telegramData.initData) {
            throw new Error('Немає даних для валідації');
        }

        // Перевіряємо доступність API
        const apiAvailable = await checkApiAvailability();
        if (!apiAvailable) {
            console.error('❌ [TelegramValidator] API недоступний для валідації');

            // Інкрементуємо лічильник спроб
            moduleState.retryCount++;

            if (moduleState.retryCount >= moduleState.maxRetries) {
                throw new Error('Сервер тимчасово недоступний. Спробуйте пізніше або оновіть сторінку');
            } else {
                throw new Error(`Сервер недоступний. Спроба ${moduleState.retryCount}/${moduleState.maxRetries}`);
            }
        }

        try {
            console.log('📤 [TelegramValidator] Відправка даних на сервер...');
            console.log('📊 [TelegramValidator] Довжина initData:', telegramData.initData.length);

            // Перевіряємо наявність TasksAPI
            if (!window.TasksAPI?.auth?.validateTelegram) {
                console.error('❌ [TelegramValidator] TasksAPI не доступний');
                throw new Error('API модуль не ініціалізовано');
            }

            const response = await window.TasksAPI.auth.validateTelegram(telegramData.initData);

            console.log('📊 [TelegramValidator] Відповідь сервера отримана');

            if (response.valid) {
                console.log('✅ [TelegramValidator] Серверна валідація пройдена');

                // Зберігаємо токен в sessionStorage
                if (response.token) {
                    const storageKey = window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN || 'winix_auth_token';
                    sessionStorage.setItem(storageKey, response.token);
                    console.log('💾 [TelegramValidator] Токен збережено');
                }

                // Скидаємо лічильник помилок
                moduleState.retryCount = 0;

                return {
                    valid: true,
                    user: response.user,
                    token: response.token
                };
            } else {
                console.error('❌ [TelegramValidator] Серверна валідація не пройдена');
                throw new Error(response.error || 'Валідація не пройдена');
            }

        } catch (error) {
            console.error('❌ [TelegramValidator] Помилка серверної валідації:', error);

            // Детальна інформація про помилку
            if (error.status === 401) {
                throw new Error('Помилка авторизації. Перезапустіть додаток через Telegram');
            } else if (error.status === 403) {
                throw new Error('Доступ заборонено. Перевірте права доступу');
            } else if (error.status >= 500) {
                throw new Error('Сервер тимчасово недоступний. Спробуйте пізніше');
            } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                throw new Error('Проблеми з мережею. Перевірте підключення до інтернету');
            } else if (error.message.includes('API модуль не ініціалізовано')) {
                throw new Error('Система ініціалізується. Зачекайте...');
            }

            throw new Error(error.message || 'Помилка валідації даних');
        }
    }

    /**
     * Повна валідація (локальна + серверна)
     */
    async function validateTelegramAuth() {
        console.log('🔐 [TelegramValidator] === ПОВНА ВАЛІДАЦІЯ ===');
        console.log('🕐 [TelegramValidator] Час початку:', new Date().toISOString());

        try {
            // Отримуємо дані
            const telegramData = getTelegramData();

            // Локальна валідація
            validateUserLocally(telegramData.user);

            // Серверна валідація з перевіркою доступності API
            console.log('🔄 [TelegramValidator] Переходимо до серверної валідації...');

            const serverValidation = await validateOnServer(telegramData);

            if (serverValidation.valid) {
                console.log('✅ [TelegramValidator] Валідація успішна!');

                // Оновлюємо дані користувача в сторі
                if (window.TasksStore) {
                    console.log('📝 [TelegramValidator] Оновлення даних в Store...');
                    window.TasksStore.actions.setUser({
                        id: serverValidation.user.id,
                        telegramId: serverValidation.user.telegram_id || telegramData.user.id,
                        username: serverValidation.user.username || telegramData.user.username,
                        firstName: serverValidation.user.first_name || telegramData.user.first_name,
                        lastName: serverValidation.user.last_name || telegramData.user.last_name,
                        photoUrl: serverValidation.user.photo_url || telegramData.user.photo_url,
                        languageCode: serverValidation.user.language_code || telegramData.user.language_code,
                        balance: serverValidation.user.balance || { winix: 0, tickets: 0, flex: 0 }
                    });
                    console.log('✅ [TelegramValidator] Дані користувача оновлено в Store');
                }

                return serverValidation;
            } else {
                throw new Error(serverValidation.error || 'Валідація провалена');
            }

        } catch (error) {
            console.error('❌ [TelegramValidator] Валідація провалена:', error.message);

            // Показуємо помилку користувачу
            if (window.TasksUtils?.showToast) {
                window.TasksUtils.showToast(error.message, 'error');
            }

            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Отримати збережений токен
     */
    function getAuthToken() {
        const storageKey = window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN || 'winix_auth_token';
        const token = sessionStorage.getItem(storageKey);

        if (!token) {
            console.log('🔑 [TelegramValidator] Токен відсутній');
            return null;
        }

        // Перевіряємо термін дії токену
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const exp = payload.exp * 1000;
            const now = Date.now();

            if (exp <= now) {
                console.warn('⚠️ [TelegramValidator] Токен застарілий');
                clearAuthToken();
                return null;
            }

            console.log('🔑 [TelegramValidator] Токен валідний');
            return token;

        } catch (error) {
            console.error('❌ [TelegramValidator] Помилка парсингу токену:', error);
            clearAuthToken();
            return null;
        }
    }

    /**
     * Видалити токен
     */
    function clearAuthToken() {
        console.log('🗑️ [TelegramValidator] Очищення токену');
        const storageKey = window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN || 'winix_auth_token';
        sessionStorage.removeItem(storageKey);

        // Очищаємо дані користувача зі Store
        if (window.TasksStore) {
            window.TasksStore.actions.clearUser();
        }

        console.log('✅ [TelegramValidator] Токен видалено');
    }

    /**
     * Перевірити чи користувач авторизований
     */
    function isAuthenticated() {
        try {
            // Перевіряємо наявність токену
            const token = getAuthToken();
            if (!token) {
                console.log('🔐 [TelegramValidator] Токен відсутній');
                return false;
            }

            // Перевіряємо наявність Telegram даних
            checkTelegramAvailability();

            console.log('🔐 [TelegramValidator] Користувач авторизований');
            return true;

        } catch (error) {
            console.log('🔐 [TelegramValidator] Користувач не авторизований:', error.message);
            return false;
        }
    }

    /**
     * Оновити токен
     */
    async function refreshToken() {
    console.log('🔄 [TelegramValidator] Оновлення токену...');

    const currentToken = getAuthToken();
    if (!currentToken) {
        console.error('❌ [TelegramValidator] Немає токену для оновлення');
        throw new Error('Немає токену для оновлення');
    }
    try {
        // Використовуємо WinixAPI замість TasksAPI якщо він доступний
        if (window.WinixAPI?.refreshToken) {
            const newToken = await window.WinixAPI.refreshToken();
            if (newToken) {
                console.log('✅ [TelegramValidator] Токен оновлено через WinixAPI');
                return true;
            }
        } else if (window.TasksAPI?.auth?.refreshToken) {
            const response = await window.TasksAPI.auth.refreshToken();
            if (response.token) {
                const storageKey = window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN || 'winix_auth_token';
                sessionStorage.setItem(storageKey, response.token);
                console.log('✅ [TelegramValidator] Токен оновлено через TasksAPI');
                return true;
            }
        } else {
            throw new Error('API модуль не ініціалізовано');
        }

        throw new Error('Сервер не повернув новий токен');

    } catch (error) {
        console.error('❌ [TelegramValidator] Помилка оновлення токену:', error);

        // Якщо це 400/401 помилка - очищаємо токен
        if (error.message.includes('400') || error.message.includes('401') ||
            error.message.includes('недійсний')) {
            clearAuthToken();
        }

        throw error;
    }
}

    /**
     * Налаштувати автоматичне оновлення токену
     */
    function setupTokenRefresh() {
        console.log('⏰ [TelegramValidator] Налаштування автооновлення токену');

        const refreshInterval = window.TasksConstants?.TIMERS?.SESSION_REFRESH || 30 * 60 * 1000;

        setInterval(async () => {
            if (isAuthenticated() && moduleState.apiAvailable) {
                try {
                    const token = getAuthToken();
                    if (token) {
                        // Перевіряємо чи потрібно оновити токен (за 5 хвилин до закінчення)
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        const exp = payload.exp * 1000;
                        const now = Date.now();
                        const timeUntilExpiry = exp - now;

                        if (timeUntilExpiry < 5 * 60 * 1000) { // Менше 5 хвилин
                            console.log('🔄 [TelegramValidator] Автоматичне оновлення токену');
                            await refreshToken();
                        }
                    }
                } catch (error) {
                    console.error('❌ [TelegramValidator] Помилка автооновлення токену:', error);
                }
            }
        }, refreshInterval);

        console.log(`✅ [TelegramValidator] Автооновлення налаштовано (кожні ${refreshInterval / 1000 / 60} хвилин)`);
    }

    /**
     * Налаштування WebApp
     */
    function setupWebApp() {
        console.log('📱 [TelegramValidator] Налаштування Telegram WebApp');

        try {
            checkTelegramAvailability();

            const webApp = window.Telegram.WebApp;

            // Налаштування кольорів
            if (webApp.setHeaderColor) {
                webApp.setHeaderColor('#1a1a2e');
            }

            if (webApp.setBackgroundColor) {
                webApp.setBackgroundColor('#0f0f1e');
            }

            // Розгортаємо на весь екран
            if (webApp.expand) {
                webApp.expand();
            }

            // Готовність
            if (webApp.ready) {
                webApp.ready();
            }

            console.log('✅ [TelegramValidator] WebApp налаштовано');

        } catch (error) {
            console.error('❌ [TelegramValidator] Помилка налаштування WebApp:', error);
            throw error;
        }
    }

    /**
     * Показати повідомлення про недоступність сервера
     */
    function showServerUnavailableError() {
        const container = document.querySelector('.container') || document.body;
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: #1a1a2e;
                color: white;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                padding: 20px;
                z-index: 10000;
            `;
            errorDiv.innerHTML = `
                <h2 style="color: #e74c3c; margin-bottom: 20px;">🚫 Сервер недоступний</h2>
                <p style="margin-bottom: 20px; font-size: 16px;">
                    Сервер тимчасово недоступний.<br>
                    Спробуйте оновити сторінку.
                </p>
                <p style="color: #95a5a6; font-size: 14px; margin-bottom: 20px;">
                    Якщо проблема не зникає, зверніться до підтримки
                </p>
                <button onclick="window.location.reload()" 
                        style="margin-top: 20px; padding: 10px 20px; background: #b366ff; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Оновити сторінку
                </button>
            `;
            container.appendChild(errorDiv);
        }
    }

    /**
     * Ініціалізація
     */
    function init() {
        console.log('🚀 [TelegramValidator] Ініціалізація модуля');

        try {
            // Налаштовуємо WebApp
            setupWebApp();

            // Налаштовуємо автооновлення токену
            setupTokenRefresh();

            // Перевіряємо початкові дані
            const telegramData = getTelegramData();
            if (telegramData) {
                console.log('✅ [TelegramValidator] Telegram дані доступні при ініціалізації');
            }

            moduleState.isInitialized = true;
            console.log('✅ [TelegramValidator] Модуль ініціалізовано');

        } catch (error) {
            console.error('❌ [TelegramValidator] Помилка ініціалізації:', error);

            // Показуємо критичну помилку
            const container = document.querySelector('.container') || document.body;
            if (container) {
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: #1a1a2e;
                    color: white;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                    padding: 20px;
                    z-index: 10000;
                `;
                errorDiv.innerHTML = `
                    <h2 style="color: #e74c3c; margin-bottom: 20px;">❌ Помилка ініціалізації</h2>
                    <p style="margin-bottom: 20px; font-size: 16px;">${error.message}</p>
                    <p style="color: #95a5a6; font-size: 14px;">
                        Переконайтеся, що додаток відкрито через Telegram, <br>
                        та спробуйте оновити сторінку
                    </p>
                    <button onclick="window.location.reload()" 
                            style="margin-top: 20px; padding: 10px 20px; background: #b366ff; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Оновити сторінку
                    </button>
                `;
                container.appendChild(errorDiv);
            }

            throw error;
        }
    }

    // Автоматична ініціалізація з затримкою
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(init, 100); // Невелика затримка для завантаження залежностей
        });
    } else {
        setTimeout(init, 100);
    }

    console.log('✅ [TelegramValidator] Модуль валідації Telegram готовий (Production)');

    // Публічний API
    return {
        getTelegramData,
        validateTelegramAuth,
        isAuthenticated,
        getAuthToken,
        clearAuthToken,
        refreshToken,
        setupWebApp,
        checkTelegramAvailability,
        checkApiAvailability,
        showServerUnavailableError
    };

})();

console.log('✅ [TelegramValidator] Модуль експортовано глобально (Production)');