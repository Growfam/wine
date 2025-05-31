/**
 * Модуль валідації Telegram даних для системи WINIX
 * ОПТИМІЗОВАНА ВЕРСІЯ V3 - Використовує централізовані утиліти
 */

window.TelegramValidator = (function() {
    'use strict';

    console.log('🔐 [TelegramValidator-V3] ===== ІНІЦІАЛІЗАЦІЯ ОПТИМІЗОВАНОГО МОДУЛЯ =====');

    // Використовуємо централізовані утиліти
    const { CacheManager, RequestManager, EventBus } = window;

    // Namespace для кешування
    const CACHE_NAMESPACE = CacheManager.NAMESPACES.VALIDATION;

    // RequestManager клієнт
    const apiClient = RequestManager.createClient('telegramValidator', {
        retries: 3,
        timeout: 30000
    });

    // EventBus namespace
    const eventBus = EventBus.createNamespace('telegram');

    // Стан модуля (мінімальний)
    const state = {
        isInitialized: false,
        telegramWebApp: null,
        validationPromise: null
    };

    // Конфігурація
    const config = {
        maxAuthAge: 86400, // 24 години
        tokenRefreshBuffer: 5 * 60 * 1000, // 5 хвилин до закінчення
        storageKey: window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN || 'winix_auth_token'
    };

    /**
     * Перевірка доступності API
     */
    async function checkApiAvailability(force = false) {
        const cacheKey = 'api_health';

        if (!force) {
            const cached = CacheManager.get(CACHE_NAMESPACE, cacheKey);
            if (cached !== null) return cached;
        }

        try {
            const response = await apiClient.execute(
                'api_ping',
                () => fetch('/api/ping', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(5000)
                }),
                { priority: 'low' }
            );

            const isAvailable = response.ok;

            // Кешуємо результат на 30 секунд
            CacheManager.set(CACHE_NAMESPACE, cacheKey, isAvailable, 30000);

            console.log(`${isAvailable ? '✅' : '❌'} [TelegramValidator-V3] API доступний: ${isAvailable}`);
            return isAvailable;

        } catch (error) {
            console.error('❌ [TelegramValidator-V3] API недоступний:', error);
            CacheManager.set(CACHE_NAMESPACE, cacheKey, false, 10000);
            return false;
        }
    }

    /**
     * Перевірка наявності Telegram WebApp
     */
    function checkTelegramAvailability() {
        // Кешуємо результат на весь сеанс
        const cacheKey = 'telegram_available';
        const cached = CacheManager.get(CACHE_NAMESPACE, cacheKey);

        if (cached !== null) {
            if (!cached) {
                throw new Error('Додаток повинен бути відкритий через Telegram');
            }
            return cached;
        }

        console.log('🔍 [TelegramValidator-V3] Перевірка Telegram WebApp');

        try {
            if (!window.Telegram?.WebApp) {
                throw new Error('Додаток повинен бути відкритий через Telegram');
            }

            const webApp = window.Telegram.WebApp;

            if (!webApp.initData || !webApp.initDataUnsafe?.user) {
                throw new Error('Дані користувача недоступні');
            }

            state.telegramWebApp = webApp;

            // Кешуємо на весь сеанс
            CacheManager.set(CACHE_NAMESPACE, cacheKey, true, Infinity);

            console.log('✅ [TelegramValidator-V3] Telegram WebApp доступний');
            return true;

        } catch (error) {
            CacheManager.set(CACHE_NAMESPACE, cacheKey, false, Infinity);
            console.error('❌ [TelegramValidator-V3] Помилка:', error.message);
            throw error;
        }
    }

    /**
     * Отримати Telegram дані
     */
    function getTelegramData() {
        const cacheKey = 'telegram_data';

        // Перевіряємо кеш (10 хвилин)
        const cached = CacheManager.get(CACHE_NAMESPACE, cacheKey);
        if (cached) {
            console.log('📦 [TelegramValidator-V3] Використовуємо кешовані Telegram дані');
            return cached;
        }

        console.log('📱 [TelegramValidator-V3] Отримання Telegram даних');

        // Перевірка доступності
        checkTelegramAvailability();

        const webApp = state.telegramWebApp || window.Telegram.WebApp;
        const user = webApp.initDataUnsafe.user;

        // Валідація користувача
        validateUserData(user);

        const telegramData = {
            initData: webApp.initData,
            initDataUnsafe: webApp.initDataUnsafe,
            user: user,
            auth_date: webApp.initDataUnsafe.auth_date || null,
            hash: webApp.initDataUnsafe.hash || null
        };

        // Кешуємо на 10 хвилин
        CacheManager.set(CACHE_NAMESPACE, cacheKey, telegramData, 10 * 60 * 1000);

        console.log('✅ [TelegramValidator-V3] Telegram дані отримано');
        return telegramData;
    }

    /**
     * Валідація даних користувача
     */
    function validateUserData(userData) {
        if (!userData) {
            throw new Error('Дані користувача відсутні');
        }

        if (!userData.id || typeof userData.id !== 'number' || userData.id <= 0) {
            throw new Error('Невірний ID користувача');
        }

        // Перевіряємо давність auth_date
        const authDate = parseInt(userData.auth_date || 0);
        if (authDate) {
            const age = Math.floor(Date.now() / 1000) - authDate;

            if (age > config.maxAuthAge) {
                throw new Error('Дані застарілі. Оновіть сторінку');
            }

            if (age < 0) {
                throw new Error('Невірна мітка часу авторизації');
            }
        }

        // Перевіряємо ID за правилами
        const rules = window.TasksConstants?.VALIDATION_RULES?.TELEGRAM_ID;
        if (rules && (userData.id < rules.MIN || userData.id > rules.MAX)) {
            throw new Error('Невірний діапазон ID користувача');
        }

        return true;
    }

    /**
     * Валідація на сервері
     */
    async function validateOnServer(telegramData) {
        console.log('🌐 [TelegramValidator-V3] Серверна валідація');

        if (!telegramData?.initData) {
            throw new Error('Немає даних для валідації');
        }

        // Перевіряємо доступність API
        const apiAvailable = await checkApiAvailability();
        if (!apiAvailable) {
            throw new Error('Сервер тимчасово недоступний');
        }

        try {
            const response = await apiClient.execute(
                'validate_telegram',
                () => window.TasksAPI.auth.validateTelegram(telegramData),
                { priority: 'high', deduplicate: false }
            );

            if (response.valid) {
                console.log('✅ [TelegramValidator-V3] Валідація пройдена');

                // Зберігаємо токен
                if (response.token) {
                    saveToken(response.token);
                    scheduleTokenRefresh(response.token);
                }

                return {
                    valid: true,
                    user: response.user,
                    token: response.token
                };
            } else {
                throw new Error(response.error || 'Валідація не пройдена');
            }

        } catch (error) {
            console.error('❌ [TelegramValidator-V3] Помилка валідації:', error);

            // Обробка специфічних помилок
            if (error.status === 401) {
                throw new Error('Помилка авторизації. Перезапустіть додаток');
            } else if (error.status === 403) {
                throw new Error('Доступ заборонено');
            } else if (error.status >= 500) {
                throw new Error('Сервер тимчасово недоступний');
            }

            throw error;
        }
    }

    /**
     * Повна валідація
     */
    async function validateTelegramAuth() {
        console.log('🔐 [TelegramValidator-V3] === ПОВНА ВАЛІДАЦІЯ ===');

        // Перевіряємо кеш валідації
        const cacheKey = 'validation_result';
        const cached = CacheManager.get(CACHE_NAMESPACE, cacheKey);

        if (cached) {
            console.log('✅ [TelegramValidator-V3] Використовуємо кешовану валідацію');

            // Оновлюємо Store якщо потрібно
            updateUserInStore(cached.user);

            return cached;
        }

        // Уникаємо множинних валідацій
        if (state.validationPromise) {
            console.log('⏸️ [TelegramValidator-V3] Валідація вже виконується');
            return state.validationPromise;
        }

        state.validationPromise = performValidation();

        try {
            const result = await state.validationPromise;
            return result;
        } finally {
            state.validationPromise = null;
        }
    }

    /**
     * Виконати валідацію
     */
    async function performValidation() {
        try {
            // Отримуємо дані
            const telegramData = getTelegramData();

            // Серверна валідація
            const serverValidation = await validateOnServer(telegramData);

            if (serverValidation.valid) {
                const validationResult = {
                    valid: true,
                    user: {
                        ...serverValidation.user,
                        telegram_id: serverValidation.user.telegram_id || telegramData.user.id
                    },
                    timestamp: Date.now()
                };

                // Кешуємо на 5 хвилин
                CacheManager.set(CACHE_NAMESPACE, cacheKey, validationResult, 5 * 60 * 1000);

                // Оновлюємо Store
                updateUserInStore(validationResult.user);

                // Емітуємо подію
                EventBus.emit(EventBus.EVENTS.USER_LOGGED_IN, {
                    userId: validationResult.user.id,
                    user: validationResult.user
                });

                return validationResult;
            }

        } catch (error) {
            console.error('❌ [TelegramValidator-V3] Валідація провалена:', error);

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
     * Оновити користувача в Store
     */
    function updateUserInStore(user) {
        if (!window.TasksStore) return;

        window.TasksStore.actions.setUser({
            id: user.id,
            telegramId: user.telegram_id || user.id,
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
            photoUrl: user.photo_url,
            languageCode: user.language_code,
            balance: user.balance || { winix: 0, tickets: 0, flex: 0 }
        });

        console.log('✅ [TelegramValidator-V3] Користувач оновлено в Store');
    }

    /**
     * Управління токенами (спрощене)
     */
    function saveToken(token) {
        sessionStorage.setItem(config.storageKey, token);
        console.log('💾 [TelegramValidator-V3] Токен збережено');
    }

    function getAuthToken() {
        const token = sessionStorage.getItem(config.storageKey);

        if (!token) return null;

        try {
            // Перевіряємо чи не застарілий
            const [, payloadBase64] = token.split('.');
            const payload = JSON.parse(atob(payloadBase64));

            if (payload.exp * 1000 <= Date.now()) {
                clearAuthToken();
                return null;
            }

            return token;
        } catch {
            return null;
        }
    }

    function clearAuthToken() {
        sessionStorage.removeItem(config.storageKey);
        CacheManager.invalidateNamespace(CACHE_NAMESPACE);

        if (window.TasksStore) {
            window.TasksStore.actions.clearUser();
        }

        console.log('🗑️ [TelegramValidator-V3] Токен видалено');
    }

    /**
     * Планування оновлення токену
     */
    function scheduleTokenRefresh(token) {
        try {
            const [, payloadBase64] = token.split('.');
            const payload = JSON.parse(atob(payloadBase64));
            const timeToExpiry = payload.exp * 1000 - Date.now();

            if (timeToExpiry > config.tokenRefreshBuffer) {
                const refreshTime = timeToExpiry - config.tokenRefreshBuffer;

                setTimeout(async () => {
                    console.log('🔄 [TelegramValidator-V3] Час оновити токен');
                    await refreshToken();
                }, Math.min(refreshTime, 30 * 60 * 1000)); // Максимум 30 хвилин

                console.log(`⏰ [TelegramValidator-V3] Оновлення заплановано через ${Math.round(refreshTime / 1000 / 60)} хв`);
            }
        } catch (error) {
            console.error('❌ [TelegramValidator-V3] Помилка планування оновлення:', error);
        }
    }

    /**
     * Оновити токен
     */
    async function refreshToken() {
        console.log('🔄 [TelegramValidator-V3] Оновлення токену');

        try {
            // Спочатку через TasksAPI
            if (window.TasksAPI?.auth?.refreshToken) {
                const response = await apiClient.execute(
                    'refresh_token',
                    () => window.TasksAPI.auth.refreshToken(),
                    { priority: 'high' }
                );

                if (response.token) {
                    saveToken(response.token);
                    scheduleTokenRefresh(response.token);

                    // Інвалідуємо кеш валідації
                    CacheManager.invalidate(CACHE_NAMESPACE, 'validation_result');

                    return true;
                }
            }

            console.warn('⚠️ [TelegramValidator-V3] Не вдалось оновити токен');
            return false;

        } catch (error) {
            console.error('❌ [TelegramValidator-V3] Помилка оновлення:', error);

            if (error.status === 401) {
                clearAuthToken();
                window.TasksUtils?.showToast('Сесія закінчилася. Оновіть сторінку', 'error');
                setTimeout(() => window.location.reload(), 2000);
            }

            throw error;
        }
    }

    /**
     * Перевірити чи користувач авторизований
     */
    function isAuthenticated() {
        // Швидка перевірка токену
        if (!getAuthToken()) {
            return false;
        }

        // Перевіряємо кешовану валідацію
        const cached = CacheManager.get(CACHE_NAMESPACE, 'validation_result');
        if (cached?.valid) {
            return true;
        }

        // Перевіряємо наявність Telegram
        try {
            checkTelegramAvailability();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Налаштування WebApp
     */
    function setupWebApp() {
        const cacheKey = 'webapp_setup';

        if (CacheManager.get(CACHE_NAMESPACE, cacheKey)) {
            return;
        }

        console.log('📱 [TelegramValidator-V3] Налаштування WebApp');

        try {
            checkTelegramAvailability();

            const webApp = state.telegramWebApp || window.Telegram.WebApp;

            // Налаштування
            webApp.setHeaderColor?.('#1a1a2e');
            webApp.setBackgroundColor?.('#0f0f1e');
            webApp.expand?.();
            webApp.ready?.();

            CacheManager.set(CACHE_NAMESPACE, cacheKey, true, Infinity);

            console.log('✅ [TelegramValidator-V3] WebApp налаштовано');

        } catch (error) {
            console.error('❌ [TelegramValidator-V3] Помилка налаштування:', error);
        }
    }

    /**
     * Ініціалізація
     */
    function init() {
        if (state.isInitialized) {
            return;
        }

        console.log('🚀 [TelegramValidator-V3] Ініціалізація');

        try {
            // Налаштовуємо WebApp
            setupWebApp();

            // Перевіряємо початкові дані
            const telegramData = getTelegramData();
            if (telegramData) {
                console.log('✅ [TelegramValidator-V3] Telegram дані доступні');
            }

            // Перевіряємо токен
            const token = getAuthToken();
            if (token) {
                console.log('🔑 [TelegramValidator-V3] Знайдено валідний токен');
                scheduleTokenRefresh(token);
            }

            // Слухач видимості
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && getAuthToken()) {
                    // Можна перевірити чи потрібно оновити токен
                    const token = getAuthToken();
                    if (token) {
                        try {
                            const [, payloadBase64] = token.split('.');
                            const payload = JSON.parse(atob(payloadBase64));
                            const timeToExpiry = payload.exp * 1000 - Date.now();

                            if (timeToExpiry < config.tokenRefreshBuffer) {
                                refreshToken().catch(console.error);
                            }
                        } catch {}
                    }
                }
            });

            state.isInitialized = true;

            // Емітуємо подію готовності
            EventBus.emit('validator.telegram.ready');

            console.log('✅ [TelegramValidator-V3] Модуль ініціалізовано');

        } catch (error) {
            console.error('❌ [TelegramValidator-V3] Помилка ініціалізації:', error);
            showInitError(error);
            throw error;
        }
    }

    /**
     * Показати помилку ініціалізації
     */
    function showInitError(error) {
        // Емітуємо подію помилки
        EventBus.emit(EventBus.EVENTS.APP_ERROR, {
            module: 'telegramValidator',
            error: error.message,
            critical: true
        });

        // Простий UI для помилки
        const container = document.querySelector('.container') || document.body;
        if (!container) return;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'telegram-init-error';
        errorDiv.innerHTML = `
            <h2>❌ Помилка ініціалізації</h2>
            <p>${error.message}</p>
            <p>Переконайтеся, що додаток відкрито через Telegram</p>
            <button onclick="window.location.reload()">Оновити сторінку</button>
        `;

        container.appendChild(errorDiv);
    }

    /**
     * Знищити модуль
     */
    function destroy() {
        console.log('🗑️ [TelegramValidator-V3] Знищення модуля');

        // Очищаємо стан
        state.isInitialized = false;
        state.telegramWebApp = null;
        state.validationPromise = null;

        console.log('✅ [TelegramValidator-V3] Модуль знищено');
    }

    // Автоматична ініціалізація
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
    } else {
        setTimeout(init, 100);
    }

    console.log('✅ [TelegramValidator-V3] Модуль готовий (Централізовані утиліти)');

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
        destroy,
        init
    };

})();

console.log('✅ [TelegramValidator-V3] Модуль експортовано глобально');