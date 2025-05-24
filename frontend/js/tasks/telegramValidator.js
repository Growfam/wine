/**
 * Модуль валідації Telegram даних для системи WINIX
 * Перевірка автентичності Telegram WebApp даних
 */

window.TelegramValidator = (function() {
    'use strict';

    console.log('🔐 [TelegramValidator] ===== ІНІЦІАЛІЗАЦІЯ МОДУЛЯ ВАЛІДАЦІЇ TELEGRAM =====');

    /**
     * Отримати та валідувати Telegram дані
     */
    function getTelegramData() {
        console.log('📱 [TelegramValidator] Отримання Telegram даних...');

        if (!window.Telegram?.WebApp) {
            console.error('❌ [TelegramValidator] Telegram WebApp не знайдено');
            return null;
        }

        const webApp = window.Telegram.WebApp;
        const initData = webApp.initData;
        const initDataUnsafe = webApp.initDataUnsafe;

        if (!initData || !initDataUnsafe) {
            console.error('❌ [TelegramValidator] Telegram дані відсутні');
            return null;
        }

        console.log('✅ [TelegramValidator] Telegram дані отримано');

        return {
            initData: initData,
            initDataUnsafe: initDataUnsafe,
            user: initDataUnsafe.user || null,
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
            console.error('❌ [TelegramValidator] Дані користувача відсутні');
            return false;
        }

        // Перевіряємо обов'язкові поля
        const requiredFields = ['id'];
        for (const field of requiredFields) {
            if (!userData[field]) {
                console.error(`❌ [TelegramValidator] Відсутнє обов'язкове поле: ${field}`);
                return false;
            }
        }

        // Перевіряємо тип ID
        if (typeof userData.id !== 'number' || userData.id <= 0) {
            console.error('❌ [TelegramValidator] Невірний формат ID користувача');
            return false;
        }

        // Перевіряємо давність auth_date
        const authDate = parseInt(userData.auth_date || 0);
        const currentTime = Math.floor(Date.now() / 1000);
        const maxAge = 86400; // 24 години

        if (authDate && (currentTime - authDate) > maxAge) {
            console.error('❌ [TelegramValidator] Дані застарілі');
            return false;
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
            console.error('❌ [TelegramValidator] Немає даних для валідації');
            return { valid: false, error: 'No data' };
        }

        try {
            const response = await window.TasksAPI.call('/auth/validate-telegram', {
                method: 'POST',
                body: {
                    initData: telegramData.initData,
                    timestamp: Date.now()
                }
            });

            console.log('📊 [TelegramValidator] Відповідь сервера:', response);

            if (response.valid) {
                console.log('✅ [TelegramValidator] Серверна валідація пройдена');

                // Зберігаємо токен в sessionStorage
                if (response.token) {
                    sessionStorage.setItem(window.TasksConstants.STORAGE_KEYS.AUTH_TOKEN, response.token);
                    console.log('💾 [TelegramValidator] Токен збережено');
                }

                return {
                    valid: true,
                    user: response.user,
                    token: response.token
                };
            } else {
                console.error('❌ [TelegramValidator] Серверна валідація не пройдена');
                return {
                    valid: false,
                    error: response.error || 'Validation failed'
                };
            }

        } catch (error) {
            console.error('❌ [TelegramValidator] Помилка серверної валідації:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Повна валідація (локальна + серверна)
     */
    async function validateTelegramAuth() {
        console.log('🔐 [TelegramValidator] === ПОВНА ВАЛІДАЦІЯ ===');

        // Отримуємо дані
        const telegramData = getTelegramData();
        if (!telegramData) {
            return {
                valid: false,
                error: 'No Telegram data'
            };
        }

        // Локальна валідація
        if (!validateUserLocally(telegramData.user)) {
            return {
                valid: false,
                error: 'Local validation failed'
            };
        }

        // Серверна валідація
        const serverValidation = await validateOnServer(telegramData);

        if (serverValidation.valid) {
            // Оновлюємо дані користувача в сторі
            if (window.TasksStore) {
                window.TasksStore.actions.setUser({
                    id: serverValidation.user.id,
                    telegramId: serverValidation.user.telegramId,
                    username: serverValidation.user.username,
                    firstName: serverValidation.user.firstName,
                    lastName: serverValidation.user.lastName,
                    photoUrl: serverValidation.user.photoUrl,
                    languageCode: serverValidation.user.languageCode
                });
            }
        }

        return serverValidation;
    }

    /**
     * Отримати збережений токен
     */
    function getAuthToken() {
        const token = sessionStorage.getItem(window.TasksConstants.STORAGE_KEYS.AUTH_TOKEN);
        console.log('🔑 [TelegramValidator] Токен:', token ? 'Присутній' : 'Відсутній');
        return token;
    }

    /**
     * Видалити токен
     */
    function clearAuthToken() {
        console.log('🗑️ [TelegramValidator] Очищення токену');
        sessionStorage.removeItem(window.TasksConstants.STORAGE_KEYS.AUTH_TOKEN);
    }

    /**
     * Перевірити чи користувач авторизований
     */
    function isAuthenticated() {
        const token = getAuthToken();
        const hasToken = !!token;
        const hasTelegramData = !!getTelegramData();

        const isAuth = hasToken && hasTelegramData;
        console.log('🔐 [TelegramValidator] Авторизований:', isAuth);

        return isAuth;
    }

    /**
     * Оновити токен
     */
    async function refreshToken() {
        console.log('🔄 [TelegramValidator] Оновлення токену...');

        const currentToken = getAuthToken();
        if (!currentToken) {
            console.error('❌ [TelegramValidator] Немає токену для оновлення');
            return false;
        }

        try {
            const response = await window.TasksAPI.call('/auth/refresh-token', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            });

            if (response.token) {
                sessionStorage.setItem(window.TasksConstants.STORAGE_KEYS.AUTH_TOKEN, response.token);
                console.log('✅ [TelegramValidator] Токен оновлено');
                return true;
            }

            return false;

        } catch (error) {
            console.error('❌ [TelegramValidator] Помилка оновлення токену:', error);
            clearAuthToken();
            return false;
        }
    }

    /**
     * Налаштувати автоматичне оновлення токену
     */
    function setupTokenRefresh() {
        console.log('⏰ [TelegramValidator] Налаштування автооновлення токену');

        // Оновлюємо кожні 30 хвилин
        setInterval(async () => {
            if (isAuthenticated()) {
                console.log('🔄 [TelegramValidator] Автоматичне оновлення токену');
                await refreshToken();
            }
        }, window.TasksConstants.TIMERS.SESSION_REFRESH);
    }

    /**
     * Форматувати дані для відправки
     */
    function formatInitData(data) {
        const params = new URLSearchParams();

        // Додаємо всі параметри крім hash
        Object.entries(data).forEach(([key, value]) => {
            if (key !== 'hash' && value !== undefined && value !== null) {
                if (typeof value === 'object') {
                    params.append(key, JSON.stringify(value));
                } else {
                    params.append(key, String(value));
                }
            }
        });

        // Сортуємо параметри алфавітно
        const sortedParams = new URLSearchParams([...params].sort());

        // Додаємо hash в кінці
        if (data.hash) {
            sortedParams.append('hash', data.hash);
        }

        return sortedParams.toString();
    }

    /**
     * Налаштування WebApp
     */
    function setupWebApp() {
        console.log('📱 [TelegramValidator] Налаштування Telegram WebApp');

        if (!window.Telegram?.WebApp) {
            console.error('❌ [TelegramValidator] Telegram WebApp недоступний');
            return;
        }

        const webApp = window.Telegram.WebApp;

        // Налаштування кольорів
        webApp.setHeaderColor('#1a1a2e');
        webApp.setBackgroundColor('#0f0f1e');

        // Розгортаємо на весь екран
        webApp.expand();

        // Готовність
        webApp.ready();

        console.log('✅ [TelegramValidator] WebApp налаштовано');
    }

    /**
     * Ініціалізація
     */
    function init() {
        console.log('🚀 [TelegramValidator] Ініціалізація');

        // Налаштовуємо WebApp
        setupWebApp();

        // Налаштовуємо автооновлення токену
        setupTokenRefresh();

        console.log('✅ [TelegramValidator] Модуль ініціалізовано');
    }

    // Автоматична ініціалізація
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('✅ [TelegramValidator] Модуль валідації Telegram готовий');

    // Публічний API
    return {
        getTelegramData,
        validateTelegramAuth,
        isAuthenticated,
        getAuthToken,
        clearAuthToken,
        refreshToken,
        formatInitData,
        setupWebApp
    };

})();

console.log('✅ [TelegramValidator] Модуль експортовано глобально');