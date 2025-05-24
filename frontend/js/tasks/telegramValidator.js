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

        // Додаткове логування для діагностики
        console.log('🔍 [TelegramValidator] window.Telegram:', window.Telegram);
        console.log('🔍 [TelegramValidator] window.Telegram.WebApp:', window.Telegram?.WebApp);

        if (!window.Telegram?.WebApp) {
            console.error('❌ [TelegramValidator] Telegram WebApp не знайдено');
            console.error('❌ [TelegramValidator] Переконайтеся, що додаток відкрито через Telegram');
            return null;
        }

        const webApp = window.Telegram.WebApp;
        const initData = webApp.initData;
        const initDataUnsafe = webApp.initDataUnsafe;

        // Детальне логування даних
        console.log('🔍 [TelegramValidator] initData:', initData);
        console.log('🔍 [TelegramValidator] initDataUnsafe:', initDataUnsafe);
        console.log('🔍 [TelegramValidator] webApp.version:', webApp.version);
        console.log('🔍 [TelegramValidator] webApp.platform:', webApp.platform);

        if (!initData || !initDataUnsafe) {
            console.error('❌ [TelegramValidator] Telegram дані відсутні');
            console.error('❌ [TelegramValidator] Можлива причина: додаток відкрито не через Telegram');
            return null;
        }

        console.log('✅ [TelegramValidator] Telegram дані отримано');
        console.log('👤 [TelegramValidator] Користувач:', initDataUnsafe.user);

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
        console.log('📊 [TelegramValidator] Дані для валідації:', userData);

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
            console.error('❌ [TelegramValidator] Невірний формат ID користувача:', userData.id);
            return false;
        }

        // Перевіряємо давність auth_date якщо є
        const authDate = parseInt(userData.auth_date || 0);
        if (authDate) {
            const currentTime = Math.floor(Date.now() / 1000);
            const maxAge = 86400; // 24 години
            const age = currentTime - authDate;

            console.log('⏰ [TelegramValidator] Вік даних:', age, 'секунд');

            if (age > maxAge) {
                console.error('❌ [TelegramValidator] Дані застарілі (старші 24 годин)');
                return false;
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
            console.error('❌ [TelegramValidator] Немає даних для валідації');
            return { valid: false, error: 'No data' };
        }

        try {
            console.log('📤 [TelegramValidator] Відправка даних на сервер...');
            console.log('📊 [TelegramValidator] URL:', '/auth/validate-telegram');
            console.log('📊 [TelegramValidator] Довжина initData:', telegramData.initData.length);

            const response = await window.TasksAPI.auth.validateTelegram(telegramData.initData);

            console.log('📊 [TelegramValidator] Відповідь сервера:', response);

            if (response.valid) {
                console.log('✅ [TelegramValidator] Серверна валідація пройдена');

                // Зберігаємо токен в sessionStorage
                if (response.token) {
                    const storageKey = window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN || 'winix_auth_token';
                    sessionStorage.setItem(storageKey, response.token);
                    console.log('💾 [TelegramValidator] Токен збережено в sessionStorage');
                    console.log('🔑 [TelegramValidator] Ключ:', storageKey);
                }

                return {
                    valid: true,
                    user: response.user,
                    token: response.token
                };
            } else {
                console.error('❌ [TelegramValidator] Серверна валідація не пройдена');
                console.error('❌ [TelegramValidator] Причина:', response.error || 'Unknown');
                return {
                    valid: false,
                    error: response.error || 'Validation failed'
                };
            }

        } catch (error) {
            console.error('❌ [TelegramValidator] Помилка серверної валідації:', error);
            console.error('❌ [TelegramValidator] Stack:', error.stack);

            // Детальна інформація про помилку
            if (error.response) {
                console.error('❌ [TelegramValidator] Response status:', error.response.status);
                console.error('❌ [TelegramValidator] Response data:', error.response.data);
            }

            return {
                valid: false,
                error: error.message || 'Network error'
            };
        }
    }

    /**
     * Повна валідація (локальна + серверна)
     */
    async function validateTelegramAuth() {
        console.log('🔐 [TelegramValidator] === ПОВНА ВАЛІДАЦІЯ ===');
        console.log('🕐 [TelegramValidator] Час початку:', new Date().toISOString());

        // Отримуємо дані
        const telegramData = getTelegramData();
        if (!telegramData) {
            console.error('❌ [TelegramValidator] Не вдалося отримати Telegram дані');
            return {
                valid: false,
                error: 'No Telegram data available'
            };
        }

        // Локальна валідація
        if (!validateUserLocally(telegramData.user)) {
            console.error('❌ [TelegramValidator] Локальна валідація провалена');
            return {
                valid: false,
                error: 'Local validation failed'
            };
        }

        // Серверна валідація
        console.log('🔄 [TelegramValidator] Переходимо до серверної валідації...');
        const serverValidation = await validateOnServer(telegramData);

        if (serverValidation.valid) {
            console.log('✅ [TelegramValidator] Валідація успішна!');

            // Оновлюємо дані користувача в сторі
            if (window.TasksStore) {
                console.log('📝 [TelegramValidator] Оновлення даних в Store...');
                window.TasksStore.actions.setUser({
                    id: serverValidation.user.id,
                    telegramId: serverValidation.user.telegramId || telegramData.user.id,
                    username: serverValidation.user.username || telegramData.user.username,
                    firstName: serverValidation.user.firstName || telegramData.user.first_name,
                    lastName: serverValidation.user.lastName || telegramData.user.last_name,
                    photoUrl: serverValidation.user.photoUrl || telegramData.user.photo_url,
                    languageCode: serverValidation.user.languageCode || telegramData.user.language_code
                });
                console.log('✅ [TelegramValidator] Дані користувача оновлено в Store');
            }
        } else {
            console.error('❌ [TelegramValidator] Валідація провалена:', serverValidation.error);
        }

        return serverValidation;
    }

    /**
     * Отримати збережений токен
     */
    function getAuthToken() {
        const storageKey = window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN || 'winix_auth_token';
        const token = sessionStorage.getItem(storageKey);
        console.log('🔑 [TelegramValidator] Отримання токену з ключа:', storageKey);
        console.log('🔑 [TelegramValidator] Токен:', token ? 'Присутній' : 'Відсутній');
        return token;
    }

    /**
     * Видалити токен
     */
    function clearAuthToken() {
        console.log('🗑️ [TelegramValidator] Очищення токену');
        const storageKey = window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN || 'winix_auth_token';
        sessionStorage.removeItem(storageKey);
        console.log('✅ [TelegramValidator] Токен видалено');
    }

    /**
     * Перевірити чи користувач авторизований
     */
    function isAuthenticated() {
        const token = getAuthToken();
        const hasToken = !!token;
        const telegramData = getTelegramData();
        const hasTelegramData = !!telegramData;

        const isAuth = hasToken && hasTelegramData;

        console.log('🔐 [TelegramValidator] Перевірка авторизації:', {
            hasToken,
            hasTelegramData,
            isAuthenticated: isAuth
        });

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
            const response = await window.TasksAPI.auth.refreshToken();

            if (response.token) {
                const storageKey = window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN || 'winix_auth_token';
                sessionStorage.setItem(storageKey, response.token);
                console.log('✅ [TelegramValidator] Токен оновлено');
                return true;
            }

            console.error('❌ [TelegramValidator] Сервер не повернув новий токен');
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

        const refreshInterval = window.TasksConstants?.TIMERS?.SESSION_REFRESH || 30 * 60 * 1000;

        // Оновлюємо кожні 30 хвилин
        setInterval(async () => {
            if (isAuthenticated()) {
                console.log('🔄 [TelegramValidator] Автоматичне оновлення токену');
                await refreshToken();
            }
        }, refreshInterval);

        console.log(`✅ [TelegramValidator] Автооновлення налаштовано (кожні ${refreshInterval / 1000 / 60} хвилин)`);
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

        // Логування поточних налаштувань
        console.log('📊 [TelegramValidator] Поточні налаштування WebApp:', {
            version: webApp.version,
            platform: webApp.platform,
            colorScheme: webApp.colorScheme,
            viewportHeight: webApp.viewportHeight,
            viewportStableHeight: webApp.viewportStableHeight
        });

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
        console.log('🚀 [TelegramValidator] Ініціалізація модуля');

        // Налаштовуємо WebApp
        setupWebApp();

        // Налаштовуємо автооновлення токену
        setupTokenRefresh();

        // Логуємо початкові дані
        const telegramData = getTelegramData();
        if (telegramData) {
            console.log('✅ [TelegramValidator] Telegram дані доступні при ініціалізації');
        } else {
            console.warn('⚠️ [TelegramValidator] Telegram дані відсутні при ініціалізації');
        }

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