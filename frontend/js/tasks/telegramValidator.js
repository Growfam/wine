/**
 * Модуль валідації Telegram даних для системи WINIX - Оптимізована версія V2
 * Smart кешування, ефективний токен менеджмент та усунення зайвих перевірок
 */

window.TelegramValidator = (function() {
    'use strict';

    console.log('🔐 [TelegramValidator-V2] ===== ІНІЦІАЛІЗАЦІЯ ОПТИМІЗОВАНОГО МОДУЛЯ =====');

    // Кеш менеджер для валідації
    const ValidationCache = {
        cache: new Map(),
        ttl: {
            validation: 5 * 60 * 1000,    // 5 хвилин
            apiHealth: 30 * 1000,         // 30 секунд
            telegramData: 10 * 60 * 1000, // 10 хвилин
            tokenInfo: 60 * 1000          // 1 хвилина
        },

        set(key, data, customTTL) {
            const ttl = customTTL || this.ttl[key.split('_')[0]] || 60000;

            this.cache.set(key, {
                data,
                timestamp: Date.now(),
                ttl
            });

            // Автоочищення
            setTimeout(() => this.invalidate(key), ttl);
        },

        get(key) {
            const cached = this.cache.get(key);
            if (!cached) return null;

            const age = Date.now() - cached.timestamp;
            if (age > cached.ttl) {
                this.invalidate(key);
                return null;
            }

            return cached.data;
        },

        invalidate(key) {
            this.cache.delete(key);
        },

        clear() {
            this.cache.clear();
        }
    };

    // Token Manager для ефективного управління токенами
    const TokenManager = {
        tokenInfo: null,
        refreshPromise: null,
        refreshScheduled: false,

        getTokenInfo() {
            // Кешована перевірка
            const cached = ValidationCache.get('tokenInfo');
            if (cached) return cached;

            const token = this.getRawToken();
            if (!token) return null;

            try {
                const [, payloadBase64] = token.split('.');
                const payload = JSON.parse(atob(payloadBase64));

                const info = {
                    token,
                    exp: payload.exp * 1000,
                    iat: payload.iat * 1000,
                    userId: payload.sub || payload.user_id,
                    timeToExpiry: payload.exp * 1000 - Date.now(),
                    isExpired: payload.exp * 1000 <= Date.now(),
                    needsRefresh: payload.exp * 1000 - Date.now() < 5 * 60 * 1000
                };

                // Кешуємо інформацію
                ValidationCache.set('tokenInfo', info);
                this.tokenInfo = info;

                return info;

            } catch (error) {
                console.error('❌ [TokenManager] Помилка парсингу токену:', error);
                return null;
            }
        },

        getRawToken() {
            const storageKey = window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN || 'winix_auth_token';
            return sessionStorage.getItem(storageKey);
        },

        saveToken(token) {
            const storageKey = window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN || 'winix_auth_token';
            sessionStorage.setItem(storageKey, token);
            ValidationCache.invalidate('tokenInfo');
            this.tokenInfo = null;
        },

        clearToken() {
            const storageKey = window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN || 'winix_auth_token';
            sessionStorage.removeItem(storageKey);
            ValidationCache.invalidate('tokenInfo');
            this.tokenInfo = null;
        },

        async refreshToken() {
            // Уникаємо множинних викликів
            if (this.refreshPromise) {
                console.log('⏸️ [TokenManager] Повертаємо існуючий refresh promise');
                return this.refreshPromise;
            }

            this.refreshPromise = this._refreshTokenInternal();

            try {
                const result = await this.refreshPromise;
                return result;
            } finally {
                this.refreshPromise = null;
            }
        },

        async _refreshTokenInternal() {
            console.log('🔄 [TokenManager] Оновлення токену...');

            try {
                // Пріоритет 1: WinixAPI
                if (window.WinixAPI?.refreshToken) {
                    const newToken = await window.WinixAPI.refreshToken();
                    if (newToken) {
                        this.saveToken(newToken);
                        console.log('✅ [TokenManager] Токен оновлено через WinixAPI');
                        return true;
                    }
                }

                // Пріоритет 2: TasksAPI
                if (window.TasksAPI?.auth?.refreshToken) {
                    const response = await window.TasksAPI.auth.refreshToken();
                    if (response.token) {
                        this.saveToken(response.token);
                        console.log('✅ [TokenManager] Токен оновлено через TasksAPI');
                        return true;
                    }
                }

                console.warn('⚠️ [TokenManager] Не вдалось оновити токен');
                return false;

            } catch (error) {
                console.error('❌ [TokenManager] Помилка оновлення токену:', error);

                if (error.status === 401 || error.message?.includes('401')) {
                    this.clearToken();
                }

                throw error;
            }
        },

        scheduleRefresh() {
            if (this.refreshScheduled) return;

            const info = this.getTokenInfo();
            if (!info || info.isExpired) return;

            // Планируємо оновлення за 5 хвилин до закінчення
            const timeUntilRefresh = info.timeToExpiry - 5 * 60 * 1000;

            if (timeUntilRefresh > 0) {
                this.refreshScheduled = true;

                setTimeout(async () => {
                    this.refreshScheduled = false;

                    try {
                        await this.refreshToken();
                        // Плануємо наступне оновлення
                        this.scheduleRefresh();
                    } catch (error) {
                        console.error('❌ [TokenManager] Помилка планового оновлення:', error);
                    }
                }, Math.min(timeUntilRefresh, 30 * 60 * 1000)); // Максимум 30 хвилин

                console.log(`⏰ [TokenManager] Заплановано оновлення через ${Math.round(timeUntilRefresh / 1000 / 60)} хвилин`);
            }
        }
    };

    // Стан модуля
    const moduleState = {
        isInitialized: false,
        apiAvailable: false,
        lastApiCheck: 0,
        retryCount: 0,
        maxRetries: 3,
        telegramDataCache: null,
        validationPromise: null
    };

    // Request Queue для уникнення дублювання
    const RequestQueue = {
        pending: new Map(),

        async enqueue(key, requestFn) {
            if (this.pending.has(key)) {
                console.log(`📦 [RequestQueue] Повертаємо існуючий запит: ${key}`);
                return this.pending.get(key);
            }

            const promise = requestFn().finally(() => {
                this.pending.delete(key);
            });

            this.pending.set(key, promise);
            return promise;
        }
    };

    /**
     * Перевірка доступності API - ОПТИМІЗОВАНА
     */
    async function checkApiAvailability(force = false) {
        const cacheKey = 'apiHealth';

        if (!force) {
            const cached = ValidationCache.get(cacheKey);
            if (cached !== null) {
                moduleState.apiAvailable = cached;
                return cached;
            }
        }

        console.log('🔍 [TelegramValidator-V2] Перевірка доступності API...');

        try {
            const response = await fetch('/api/ping', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000)
            });

            const isAvailable = response.ok;
            moduleState.apiAvailable = isAvailable;

            // Кешуємо результат
            ValidationCache.set(cacheKey, isAvailable);

            console.log(`${isAvailable ? '✅' : '❌'} [TelegramValidator-V2] API статус:`, response.status);
            return isAvailable;

        } catch (error) {
            console.error('❌ [TelegramValidator-V2] API недоступний:', error.message);
            moduleState.apiAvailable = false;
            ValidationCache.set(cacheKey, false, 10000); // Коротший TTL для помилок
            return false;
        }
    }

    /**
     * Перевірка наявності Telegram WebApp - ОПТИМІЗОВАНА
     */
    const checkTelegramAvailability = (() => {
        let lastCheck = null;

        return function() {
            // Кешуємо результат на весь сеанс
            if (lastCheck !== null) {
                if (!lastCheck) {
                    throw new Error('Додаток повинен бути відкритий через Telegram');
                }
                return lastCheck;
            }

            console.log('🔍 [TelegramValidator-V2] Перевірка доступності Telegram WebApp...');

            try {
                if (!window.Telegram?.WebApp) {
                    lastCheck = false;
                    throw new Error('Додаток повинен бути відкритий через Telegram');
                }

                const webApp = window.Telegram.WebApp;

                if (!webApp.initData) {
                    lastCheck = false;
                    throw new Error('Невірні дані Telegram WebApp');
                }

                if (!webApp.initDataUnsafe) {
                    lastCheck = false;
                    throw new Error('Дані користувача недоступні');
                }

                console.log('✅ [TelegramValidator-V2] Telegram WebApp доступний');
                lastCheck = true;
                return true;

            } catch (error) {
                console.error('❌ [TelegramValidator-V2] Помилка перевірки:', error.message);
                throw error;
            }
        };
    })();

    /**
     * Отримати та валідувати Telegram дані - ОПТИМІЗОВАНА
     */
    function getTelegramData() {
        // Кешована версія
        if (moduleState.telegramDataCache) {
            const age = Date.now() - moduleState.telegramDataCache.timestamp;
            if (age < 10 * 60 * 1000) { // 10 хвилин
                console.log('📦 [TelegramValidator-V2] Використовуємо кешовані Telegram дані');
                return moduleState.telegramDataCache.data;
            }
        }

        console.log('📱 [TelegramValidator-V2] Отримання Telegram даних...');

        // Перевірка доступності
        checkTelegramAvailability();

        const webApp = window.Telegram.WebApp;
        const initData = webApp.initData;
        const initDataUnsafe = webApp.initDataUnsafe;

        // Перевіряємо наявність користувача
        if (!initDataUnsafe.user) {
            throw new Error('Дані користувача недоступні');
        }

        // Перевіряємо обов'язкові поля
        const user = initDataUnsafe.user;
        if (!user.id || typeof user.id !== 'number') {
            throw new Error('Невірний ID користувача');
        }

        const telegramData = {
            initData: initData,
            initDataUnsafe: initDataUnsafe,
            user: user,
            auth_date: initDataUnsafe.auth_date || null,
            hash: initDataUnsafe.hash || null,
            chat_instance: initDataUnsafe.chat_instance || null,
            chat_type: initDataUnsafe.chat_type || null,
            start_param: initDataUnsafe.start_param || null
        };

        // Кешуємо дані
        moduleState.telegramDataCache = {
            data: telegramData,
            timestamp: Date.now()
        };

        console.log('✅ [TelegramValidator-V2] Telegram дані отримано та закешовано');

        return telegramData;
    }

    /**
     * Валідація даних на сервері - ОПТИМІЗОВАНА
     */
    async function validateOnServer(telegramData) {
        console.log('🌐 [TelegramValidator-V2] === СЕРВЕРНА ВАЛІДАЦІЯ ===');

        if (!telegramData?.initData) {
            throw new Error('Немає даних для валідації');
        }

        // Використовуємо RequestQueue для уникнення дублювання
        return RequestQueue.enqueue('validation', async () => {
            // Перевіряємо доступність API
            const apiAvailable = await checkApiAvailability();
            if (!apiAvailable) {
                moduleState.retryCount++;

                if (moduleState.retryCount >= moduleState.maxRetries) {
                    throw new Error('Сервер тимчасово недоступний. Спробуйте пізніше або оновіть сторінку');
                } else {
                    throw new Error(`Сервер недоступний. Спроба ${moduleState.retryCount}/${moduleState.maxRetries}`);
                }
            }

            try {
                console.log('📤 [TelegramValidator-V2] Відправка даних на сервер...');

                if (!window.TasksAPI?.auth?.validateTelegram) {
                    throw new Error('API модуль не ініціалізовано');
                }

                const response = await window.TasksAPI.auth.validateTelegram(telegramData.initData);

                console.log('📊 [TelegramValidator-V2] Відповідь сервера отримана');

                if (response.valid) {
                    console.log('✅ [TelegramValidator-V2] Серверна валідація пройдена');

                    // Зберігаємо токен
                    if (response.token) {
                        TokenManager.saveToken(response.token);
                        TokenManager.scheduleRefresh();
                        console.log('💾 [TelegramValidator-V2] Токен збережено та заплановано оновлення');
                    }

                    // Скидаємо лічильник помилок
                    moduleState.retryCount = 0;

                    return {
                        valid: true,
                        user: response.user,
                        token: response.token
                    };
                } else {
                    throw new Error(response.error || 'Валідація не пройдена');
                }

            } catch (error) {
                console.error('❌ [TelegramValidator-V2] Помилка серверної валідації:', error);

                // Мапінг помилок
                if (error.status === 401) {
                    throw new Error('Помилка авторизації. Перезапустіть додаток через Telegram');
                } else if (error.status === 403) {
                    throw new Error('Доступ заборонено. Перевірте права доступу');
                } else if (error.status >= 500) {
                    throw new Error('Сервер тимчасово недоступний. Спробуйте пізніше');
                } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                    throw new Error('Проблеми з мережею. Перевірте підключення до інтернету');
                }

                throw error;
            }
        });
    }

    /**
     * Повна валідація - ОПТИМІЗОВАНА З КЕШУВАННЯМ
     */
    async function validateTelegramAuth() {
        console.log('🔐 [TelegramValidator-V2] === ПОВНА ВАЛІДАЦІЯ ===');

        // Перевіряємо кеш валідації
        const cachedValidation = ValidationCache.get('validation_result');
        if (cachedValidation) {
            console.log('✅ [TelegramValidator-V2] Використовуємо кешовану валідацію');

            // Оновлюємо Store якщо потрібно
            if (cachedValidation.valid && window.TasksStore) {
                const currentUserId = window.TasksStore.selectors?.getUserId?.();
                if (!currentUserId) {
                    updateUserInStore(cachedValidation.user);
                }
            }

            return cachedValidation;
        }

        // Уникаємо множинних одночасних валідацій
        if (moduleState.validationPromise) {
            console.log('⏸️ [TelegramValidator-V2] Валідація вже виконується, чекаємо...');
            return moduleState.validationPromise;
        }

        moduleState.validationPromise = performValidation();

        try {
            const result = await moduleState.validationPromise;
            return result;
        } finally {
            moduleState.validationPromise = null;
        }
    }

    /**
     * Виконати валідацію
     */
    async function performValidation() {
        try {
            // Отримуємо дані
            const telegramData = getTelegramData();

            // Локальна валідація
            validateUserLocally(telegramData.user);

            // Серверна валідація
            console.log('🔄 [TelegramValidator-V2] Переходимо до серверної валідації...');

            const serverValidation = await validateOnServer(telegramData);

            if (serverValidation.valid) {
                console.log('✅ [TelegramValidator-V2] Валідація успішна!');

                // Кешуємо результат
                const validationResult = {
                    valid: true,
                    user: {
                        ...serverValidation.user,
                        telegram_id: serverValidation.user.telegram_id || telegramData.user.id
                    },
                    timestamp: Date.now()
                };

                ValidationCache.set('validation_result', validationResult);

                // Оновлюємо Store
                updateUserInStore(validationResult.user);

                return validationResult;
            } else {
                throw new Error(serverValidation.error || 'Валідація провалена');
            }

        } catch (error) {
            console.error('❌ [TelegramValidator-V2] Валідація провалена:', error.message);

            // Показуємо помилку
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

        console.log('📝 [TelegramValidator-V2] Оновлення даних в Store...');

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

        console.log('✅ [TelegramValidator-V2] Дані користувача оновлено в Store');
    }

    /**
     * Локальна валідація користувача
     */
    function validateUserLocally(userData) {
        console.log('🔍 [TelegramValidator-V2] Локальна валідація користувача...');

        if (!userData) {
            throw new Error('Дані користувача відсутні');
        }

        // Перевіряємо обов'язкові поля
        if (!userData.id || typeof userData.id !== 'number' || userData.id <= 0) {
            throw new Error('Невірний ID користувача');
        }

        // Перевіряємо довжину username
        if (userData.username && (userData.username.length < 5 || userData.username.length > 32)) {
            console.warn('⚠️ [TelegramValidator-V2] Підозрілий username:', userData.username);
        }

        // Перевіряємо давність auth_date
        const authDate = parseInt(userData.auth_date || 0);
        if (authDate) {
            const currentTime = Math.floor(Date.now() / 1000);
            const maxAge = 86400; // 24 години
            const age = currentTime - authDate;

            console.log('⏰ [TelegramValidator-V2] Вік даних:', age, 'секунд');

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

        console.log('✅ [TelegramValidator-V2] Локальна валідація пройдена');
        return true;
    }

    /**
     * Отримати збережений токен
     */
    function getAuthToken() {
        const tokenInfo = TokenManager.getTokenInfo();

        if (!tokenInfo) {
            console.log('🔑 [TelegramValidator-V2] Токен відсутній');
            return null;
        }

        if (tokenInfo.isExpired) {
            console.warn('⚠️ [TelegramValidator-V2] Токен застарілий');
            TokenManager.clearToken();
            return null;
        }

        console.log('🔑 [TelegramValidator-V2] Токен валідний');
        return tokenInfo.token;
    }

    /**
     * Видалити токен
     */
    function clearAuthToken() {
        console.log('🗑️ [TelegramValidator-V2] Очищення токену');

        TokenManager.clearToken();
        ValidationCache.clear();

        // Очищаємо дані користувача зі Store
        if (window.TasksStore) {
            window.TasksStore.actions.clearUser();
        }

        console.log('✅ [TelegramValidator-V2] Токен та кеш видалено');
    }

    /**
     * Перевірити чи користувач авторизований - ОПТИМІЗОВАНА
     */
    function isAuthenticated() {
        // Швидка перевірка токену
        const tokenInfo = TokenManager.getTokenInfo();

        if (!tokenInfo || tokenInfo.isExpired) {
            console.log('🔐 [TelegramValidator-V2] Токен відсутній або застарілий');
            return false;
        }

        // Перевіряємо кешовану валідацію
        const cachedValidation = ValidationCache.get('validation_result');
        if (cachedValidation && cachedValidation.valid) {
            console.log('🔐 [TelegramValidator-V2] Користувач авторизований (кеш)');
            return true;
        }

        try {
            // Перевіряємо наявність Telegram даних
            checkTelegramAvailability();
            console.log('🔐 [TelegramValidator-V2] Користувач авторизований');
            return true;

        } catch (error) {
            console.log('🔐 [TelegramValidator-V2] Користувач не авторизований:', error.message);
            return false;
        }
    }

    /**
     * Оновити токен - ОПТИМІЗОВАНА
     */
    async function refreshToken() {
        console.log('🔄 [TelegramValidator-V2] Запит оновлення токену');

        const tokenInfo = TokenManager.getTokenInfo();

        // Перевіряємо чи потрібно оновлення
        if (tokenInfo && !tokenInfo.needsRefresh) {
            console.log('✅ [TelegramValidator-V2] Токен ще валідний, оновлення не потрібне');
            return true;
        }

        try {
            const result = await TokenManager.refreshToken();

            if (result) {
                // Інвалідуємо кеш валідації для нового токену
                ValidationCache.invalidate('validation_result');
            }

            return result;

        } catch (error) {
            console.error('❌ [TelegramValidator-V2] Помилка оновлення токену:', error);

            // При критичних помилках - очищаємо все
            if (error.status === 401 || error.message?.includes('401')) {
                clearAuthToken();

                if (window.TasksUtils?.showToast) {
                    window.TasksUtils.showToast('Помилка авторизації. Оновіть сторінку', 'error');
                }

                setTimeout(() => window.location.reload(), 2000);
            }

            throw error;
        }
    }

    /**
     * Налаштування WebApp - ОПТИМІЗОВАНА
     */
    const setupWebApp = (() => {
        let isSetup = false;

        return function() {
            if (isSetup) return;

            console.log('📱 [TelegramValidator-V2] Налаштування Telegram WebApp');

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

                isSetup = true;
                console.log('✅ [TelegramValidator-V2] WebApp налаштовано');

            } catch (error) {
                console.error('❌ [TelegramValidator-V2] Помилка налаштування WebApp:', error);
                throw error;
            }
        };
    })();

    /**
     * Ініціалізація - ОПТИМІЗОВАНА
     */
    function init() {
        if (moduleState.isInitialized) {
            console.log('✅ [TelegramValidator-V2] Модуль вже ініціалізовано');
            return;
        }

        console.log('🚀 [TelegramValidator-V2] Ініціалізація модуля');

        try {
            // Налаштовуємо WebApp
            setupWebApp();

            // Перевіряємо початкові дані
            const telegramData = getTelegramData();
            if (telegramData) {
                console.log('✅ [TelegramValidator-V2] Telegram дані доступні при ініціалізації');
            }

            // Перевіряємо існуючий токен
            const tokenInfo = TokenManager.getTokenInfo();
            if (tokenInfo && !tokenInfo.isExpired) {
                console.log('🔑 [TelegramValidator-V2] Знайдено валідний токен');

                // Плануємо оновлення якщо потрібно
                if (tokenInfo.needsRefresh) {
                    TokenManager.scheduleRefresh();
                }
            }

            // Налаштовуємо слухачі видимості для оптимізації
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    // Перевіряємо токен при поверненні на сторінку
                    const info = TokenManager.getTokenInfo();
                    if (info && info.needsRefresh) {
                        TokenManager.refreshToken().catch(console.error);
                    }
                }
            });

            moduleState.isInitialized = true;
            console.log('✅ [TelegramValidator-V2] Модуль ініціалізовано');

        } catch (error) {
            console.error('❌ [TelegramValidator-V2] Помилка ініціалізації:', error);

            // Показуємо критичну помилку
            showInitError(error);

            throw error;
        }
    }

    /**
     * Показати помилку ініціалізації
     */
    function showInitError(error) {
        const container = document.querySelector('.container') || document.body;
        if (!container) return;

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

    /**
     * Показати повідомлення про недоступність сервера
     */
    function showServerUnavailableError() {
        const container = document.querySelector('.container') || document.body;
        if (!container) return;

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

    /**
     * Знищити модуль
     */
    function destroy() {
        console.log('🗑️ [TelegramValidator-V2] Знищення модуля');

        // Очищаємо кеш
        ValidationCache.clear();

        // Очищаємо стан
        moduleState.telegramDataCache = null;
        moduleState.validationPromise = null;

        console.log('✅ [TelegramValidator-V2] Модуль знищено');
    }

    // Автоматична ініціалізація
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(init, 100);
        });
    } else {
        setTimeout(init, 100);
    }

    console.log('✅ [TelegramValidator-V2] Модуль валідації Telegram готовий (Optimized)');

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
        showServerUnavailableError,
        destroy,

        // Додаткові утиліти для тестування
        _cache: ValidationCache,
        _tokenManager: TokenManager,
        _queue: RequestQueue
    };

})();

console.log('✅ [TelegramValidator-V2] Модуль експортовано глобально (Optimized)');