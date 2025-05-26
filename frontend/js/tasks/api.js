/**
 * API модуль для системи завдань WINIX - Production Version
 * Централізоване управління всіма API викликами з proper dependency checking
 */

window.TasksAPI = (function() {
    'use strict';

    console.log('🌐 [TasksAPI] ===== ІНІЦІАЛІЗАЦІЯ API МОДУЛЯ (PRODUCTION) =====');

    // Перевірка залежностей при ініціалізації
    let dependenciesReady = false;
    let initializationAttempted = false;

    /**
     * Перевірка готовності залежностей
     */
    function checkDependencies() {
        console.log('🔍 [TasksAPI] Перевірка залежностей...');

        // Перевіряємо наявність базового API
        if (!window.WinixAPI) {
            console.error('❌ [TasksAPI] WinixAPI не знайдено - критична залежність відсутня');
            return false;
        }

        if (typeof window.WinixAPI.apiRequest !== 'function') {
            console.error('❌ [TasksAPI] WinixAPI.apiRequest не є функцією');
            return false;
        }

        // Перевіряємо наявність констант
        if (!window.TasksConstants) {
            console.warn('⚠️ [TasksAPI] TasksConstants не знайдено, використовуємо fallback');
        }

        // Перевіряємо наявність утиліт
        if (!window.TasksUtils) {
            console.warn('⚠️ [TasksAPI] TasksUtils не знайдено, деякі функції можуть не працювати');
        }

        console.log('✅ [TasksAPI] Базові залежності готові');
        return true;
    }

    /**
     * Ініціалізація API модуля
     */
    function initialize() {
        if (initializationAttempted) {
            return dependenciesReady;
        }

        initializationAttempted = true;
        console.log('🚀 [TasksAPI] Початок ініціалізації...');

        dependenciesReady = checkDependencies();

        if (!dependenciesReady) {
            console.error('❌ [TasksAPI] Ініціалізація провалена - залежності не готові');
            return false;
        }

        console.log('✅ [TasksAPI] API модуль успішно ініціалізовано');
        return true;
    }

    // Конфігурація з fallback значеннями
    const config = {
        baseURL: window.TasksConstants?.API_ENDPOINTS?.BASE_URL || '/api',
        timeout: 15000, // Збільшено до 15 секунд
        retryAttempts: 3,
        retryDelay: 2000 // 2 секунди між спробами
    };

    console.log('⚙️ [TasksAPI] Конфігурація:', config);

    // Стан модуля
    const state = {
        pendingRequests: new Map(),
        requestStats: {
            total: 0,
            success: 0,
            failed: 0,
            avgResponseTime: 0
        },
        rateLimiter: {
            requests: [],
            window: window.TasksConstants?.SECURITY?.RATE_LIMIT?.WINDOW || 60000,
            maxRequests: window.TasksConstants?.SECURITY?.RATE_LIMIT?.MAX_REQUESTS || 30
        },
        serverAvailable: true
    };

    /**
     * Перевірка rate limit
     */
    function checkRateLimit() {
        const now = Date.now();
        const windowStart = now - state.rateLimiter.window;

        // Видаляємо старі запити
        state.rateLimiter.requests = state.rateLimiter.requests.filter(
            timestamp => timestamp > windowStart
        );

        // Перевіряємо ліміт
        if (state.rateLimiter.requests.length >= state.rateLimiter.maxRequests) {
            console.warn('⚠️ [TasksAPI] Rate limit досягнуто');
            throw new APIError('Забагато запитів. Зачекайте хвилину', 429);
        }

        // Додаємо поточний запит
        state.rateLimiter.requests.push(now);
    }

    /**
     * Перевірка доступності сервера
     */
    async function checkServerHealth() {
        try {
            if (!window.WinixAPI?.apiRequest) {
                console.warn('⚠️ [TasksAPI] WinixAPI недоступний для health check');
                return false;
            }

            // Простий ping запит
            await window.WinixAPI.apiRequest('api/ping', 'GET', null, {
                timeout: 5000,
                suppressErrors: true
            });

            state.serverAvailable = true;
            return true;
        } catch (error) {
            console.warn('⚠️ [TasksAPI] Сервер недоступний:', error.message);
            state.serverAvailable = false;
            return false;
        }
    }

    /**
     * Базовий метод для API викликів з dependency checking
     */
    async function apiCall(endpoint, options = {}) {
        console.log('📡 [TasksAPI] === API ВИКЛИК ===');
        console.log('🔗 [TasksAPI] Endpoint:', endpoint);

        // Перевіряємо готовність модуля
        if (!dependenciesReady && !initialize()) {
            console.error('❌ [TasksAPI] API модуль не готовий');
            throw new APIError('API модуль не ініціалізовано', 500);
        }

        // Перевіряємо доступність базового API
        if (!window.WinixAPI?.apiRequest) {
            console.error('❌ [TasksAPI] Базовий API недоступний');
            throw new APIError('Базовий API недоступний', 503);
        }

        // Перевіряємо rate limit
        try {
            checkRateLimit();
        } catch (error) {
            if (window.TasksUtils?.showToast) {
                window.TasksUtils.showToast(error.message, 'error');
            }
            throw error;
        }

        // Якщо сервер був недоступний, перевіряємо його стан
        if (!state.serverAvailable) {
            console.log('🔍 [TasksAPI] Перевіряємо доступність сервера...');
            const serverHealthy = await checkServerHealth();

            if (!serverHealthy) {
                throw new APIError('Сервер тимчасово недоступний', 503);
            }
        }

        const requestId = generateRequestId();

        // Зберігаємо інформацію про запит
        state.pendingRequests.set(requestId, {
            endpoint,
            startTime: Date.now(),
            status: 'pending'
        });

        try {
            // Використовуємо базовий WinixAPI для запиту
            console.log('📤 [TasksAPI] Виконання запиту через WinixAPI...');

            const response = await window.WinixAPI.apiRequest(endpoint, options.method || 'GET', options.body || null, {
                timeout: options.timeout || config.timeout,
                suppressErrors: options.suppressErrors || false,
                headers: options.headers || {}
            });

            // Оновлюємо статистику
            updateRequestStats(requestId, true, response);

            console.log('✅ [TasksAPI] Успішна відповідь:', response);
            return response;

        } catch (error) {
            // Оновлюємо статистику
            updateRequestStats(requestId, false, error);

            console.error('❌ [TasksAPI] Помилка запиту:', error);

            // Обробляємо специфічні помилки
            if (error.message?.includes('500') || error.status === 500) {
                state.serverAvailable = false;
                throw new APIError('Сервер тимчасово недоступний. Спробуйте пізніше', 500);
            }

            if (error.message?.includes('400') || error.status === 400) {
                throw new APIError('Невірні дані запиту', 400);
            }

            if (error.message?.includes('401') || error.status === 401) {
                throw new APIError('Помилка авторизації. Оновіть сторінку', 401);
            }

            if (error.message?.includes('403') || error.status === 403) {
                throw new APIError('Доступ заборонено', 403);
            }

            if (error.message?.includes('404') || error.status === 404) {
                throw new APIError('Ресурс не знайдено', 404);
            }

            // Загальна помилка
            throw new APIError(error.message || 'Помилка API запиту', error.status || 500);

        } finally {
            // Видаляємо запит зі списку активних
            state.pendingRequests.delete(requestId);
        }
    }

    /**
     * API методи для User
     */
    const user = {
        getProfile: async (userId) => {
            console.log('👤 [TasksAPI] Отримання профілю:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            return apiCall(`user/${userId}`, {
                method: 'GET',
                suppressErrors: true
            });
        },

        getBalance: async (userId) => {
            console.log('💰 [TasksAPI] Отримання балансу користувача:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            return apiCall(`user/${userId}/balance`, {
                method: 'GET',
                suppressErrors: true
            });
        },

        updateBalance: async (userId, balances) => {
            console.log('💰 [TasksAPI] Оновлення балансу:', userId, balances);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            if (!balances || typeof balances !== 'object') {
                throw new APIError('Невірні дані балансу', 400);
            }

            return apiCall(`user/${userId}/update-balance`, {
                method: 'POST',
                body: balances
            });
        },

        getStats: async (userId) => {
            console.log('📊 [TasksAPI] Отримання статистики:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            return apiCall(`user/${userId}/stats`, {
                method: 'GET',
                suppressErrors: true
            });
        }
    };

    /**
     * API методи для Auth
     */
    const auth = {
        validateTelegram: async (initData) => {
            console.log('🔐 [TasksAPI] Валідація Telegram даних');

            if (!initData) {
                throw new APIError('Telegram дані відсутні', 400);
            }

            return apiCall('auth/validate-telegram', {
                method: 'POST',
                body: { initData, timestamp: Date.now() }
            });
        },

        refreshToken: async () => {
            console.log('🔄 [TasksAPI] Оновлення токену');

            return apiCall('auth/refresh-token', {
                method: 'POST',
                suppressErrors: true
            });
        }
    };

    /**
     * API методи для Wallet
     */
    const wallet = {
        checkStatus: async (userId) => {
            console.log('🔍 [TasksAPI] Перевірка статусу гаманця:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            return apiCall(`wallet/status/${userId}`, {
                method: 'GET',
                suppressErrors: true
            });
        },

        connect: async (userId, walletData) => {
            console.log('🔌 [TasksAPI] Підключення гаманця:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            if (!walletData || !walletData.address) {
                throw new APIError('Дані гаманця невірні', 400);
            }

            return apiCall(`wallet/connect/${userId}`, {
                method: 'POST',
                body: walletData
            });
        },

        disconnect: async (userId) => {
            console.log('🔌 [TasksAPI] Відключення гаманця:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            return apiCall(`wallet/disconnect/${userId}`, {
                method: 'POST'
            });
        },

        verify: async (userId, address) => {
            console.log('✅ [TasksAPI] Верифікація гаманця:', userId);

            if (!userId || !address) {
                throw new APIError('Невірні параметри верифікації', 400);
            }

            return apiCall(`wallet/verify/${userId}`, {
                method: 'POST',
                body: { address, timestamp: Date.now() }
            });
        }
    };

    /**
     * API методи для Flex
     */
    const flex = {
        getBalance: async (userId, walletAddress) => {
            console.log('💎 [TasksAPI] Отримання балансу FLEX:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            if (!walletAddress) {
                throw new APIError('Адреса гаманця не вказана', 400);
            }

            return apiCall(`flex/balance/${userId}`, {
                method: 'GET',
                headers: {
                    'X-Wallet-Address': walletAddress
                },
                suppressErrors: true
            });
        },

        claimReward: async (userId, level) => {
            console.log('🎁 [TasksAPI] Отримання винагороди FLEX:', userId, level);

            if (!userId || !level) {
                throw new APIError('Невірні параметри винагороди', 400);
            }

            return apiCall(`flex/claim/${userId}`, {
                method: 'POST',
                body: { level, timestamp: Date.now() }
            });
        },

        getHistory: async (userId) => {
            console.log('📜 [TasksAPI] Отримання історії FLEX:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            return apiCall(`flex/history/${userId}`, {
                method: 'GET',
                suppressErrors: true
            });
        },

        checkLevels: async (userId, flexBalance) => {
            console.log('🎯 [TasksAPI] Перевірка доступних рівнів:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            return apiCall(`flex/levels/${userId}`, {
                method: 'GET',
                headers: {
                    'X-Flex-Balance': flexBalance?.toString() || '0'
                },
                suppressErrors: true
            });
        }
    };

    /**
     * API методи для Daily Bonus
     */
    const daily = {
        getStatus: async (userId) => {
            console.log('📅 [TasksAPI] Отримання статусу щоденного бонусу:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            return apiCall(`daily/status/${userId}`, {
                method: 'GET',
                suppressErrors: true
            });
        },

        claim: async (userId) => {
            console.log('🎁 [TasksAPI] Отримання щоденного бонусу:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            return apiCall(`daily/claim/${userId}`, {
                method: 'POST',
                body: { timestamp: Date.now() }
            });
        },

        getHistory: async (userId) => {
            console.log('📜 [TasksAPI] Отримання історії щоденних бонусів:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            return apiCall(`daily/history/${userId}`, {
                method: 'GET',
                suppressErrors: true
            });
        },

        calculateReward: async (userId, dayNumber) => {
            console.log('💰 [TasksAPI] Розрахунок винагороди:', userId, dayNumber);

            if (!userId || typeof dayNumber !== 'number') {
                throw new APIError('Невірні параметри розрахунку', 400);
            }

            return apiCall(`daily/calculate-reward/${userId}`, {
                method: 'POST',
                body: { dayNumber }
            });
        }
    };

    /**
     * API методи для Tasks
     */
    const tasks = {
        getList: async (userId, type = 'all') => {
            console.log('📋 [TasksAPI] Отримання списку завдань:', userId, type);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            return apiCall(`tasks/list/${userId}?type=${type}`, {
                method: 'GET',
                suppressErrors: true
            });
        },

        start: async (userId, taskId) => {
            console.log('▶️ [TasksAPI] Початок виконання завдання:', userId, taskId);

            if (!userId || !taskId) {
                throw new APIError('Невірні параметри завдання', 400);
            }

            return apiCall(`tasks/start/${userId}/${taskId}`, {
                method: 'POST',
                body: { timestamp: Date.now() }
            });
        },

        verify: async (userId, taskId, verificationData) => {
            console.log('🔍 [TasksAPI] Верифікація завдання:', userId, taskId);

            if (!userId || !taskId) {
                throw new APIError('Невірні параметри верифікації', 400);
            }

            return apiCall(`tasks/verify/${userId}/${taskId}`, {
                method: 'POST',
                body: verificationData || {}
            });
        },

        complete: async (userId, taskId) => {
            console.log('✅ [TasksAPI] Завершення завдання:', userId, taskId);

            if (!userId || !taskId) {
                throw new APIError('Невірні параметри завершення', 400);
            }

            return apiCall(`tasks/complete/${userId}/${taskId}`, {
                method: 'POST',
                body: { timestamp: Date.now() }
            });
        },

        claim: async (userId, taskId) => {
            console.log('💰 [TasksAPI] Отримання винагороди за завдання:', userId, taskId);

            if (!userId || !taskId) {
                throw new APIError('Невірні параметри винагороди', 400);
            }

            return apiCall(`tasks/claim/${userId}/${taskId}`, {
                method: 'POST'
            });
        }
    };

    /**
     * API методи для Verification
     */
    const verify = {
        telegram: async (userId, channelUsername) => {
            console.log('📱 [TasksAPI] Верифікація Telegram підписки:', userId);

            if (!userId || !channelUsername) {
                throw new APIError('Невірні параметри верифікації', 400);
            }

            return apiCall(`verify/telegram/${userId}`, {
                method: 'POST',
                body: { channelUsername }
            });
        },

        checkBot: async (userId) => {
            console.log('🤖 [TasksAPI] Перевірка запуску бота:', userId);

            if (!userId) {
                throw new APIError('User ID не вказано', 400);
            }

            return apiCall(`verify/check-bot/${userId}`, {
                method: 'GET',
                suppressErrors: true
            });
        },

        social: async (userId, platform, data) => {
            console.log('🌐 [TasksAPI] Верифікація соціальної мережі:', userId, platform);

            if (!userId || !platform) {
                throw new APIError('Невірні параметри верифікації', 400);
            }

            return apiCall(`verify/social/${userId}/${platform}`, {
                method: 'POST',
                body: data || {}
            });
        }
    };

    /**
     * Допоміжні функції
     */
    function generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    function updateRequestStats(requestId, success, data) {
        const request = state.pendingRequests.get(requestId);
        if (!request) return;

        const responseTime = Date.now() - request.startTime;

        state.requestStats.total++;
        if (success) {
            state.requestStats.success++;
        } else {
            state.requestStats.failed++;
        }

        // Оновлюємо середній час відповіді
        const prevAvg = state.requestStats.avgResponseTime;
        const totalRequests = state.requestStats.success + state.requestStats.failed;
        state.requestStats.avgResponseTime = ((prevAvg * (totalRequests - 1)) + responseTime) / totalRequests;

        console.log('📊 [TasksAPI] Статистика запитів:', {
            всього: state.requestStats.total,
            успішних: state.requestStats.success,
            невдалих: state.requestStats.failed,
            середнійЧас: Math.round(state.requestStats.avgResponseTime) + 'мс'
        });
    }

    /**
     * Кастомний клас помилки
     */
    class APIError extends Error {
        constructor(message, status, data) {
            super(message);
            this.name = 'APIError';
            this.status = status;
            this.data = data;
        }
    }

    /**
     * Скасування всіх активних запитів
     */
    function cancelAllRequests() {
        console.log('🚫 [TasksAPI] Скасування всіх активних запитів');
        state.pendingRequests.clear();
    }

    /**
     * Отримати статистику
     */
    function getStatistics() {
        return {
            ...state.requestStats,
            pendingRequests: state.pendingRequests.size,
            rateLimitRemaining: state.rateLimiter.maxRequests - state.rateLimiter.requests.length,
            serverAvailable: state.serverAvailable,
            dependenciesReady: dependenciesReady
        };
    }

    /**
     * Перевірити готовність API
     */
    function isReady() {
        return dependenciesReady && state.serverAvailable;
    }

    /**
     * Ініціалізація при створенні модуля
     */
    setTimeout(() => {
        try {
            initialize();
        } catch (error) {
            console.error('❌ [TasksAPI] Помилка автоініціалізації:', error);
        }
    }, 100);

    console.log('✅ [TasksAPI] API модуль готовий до використання (Production)');

    // Публічний API
    return {
        // Основний метод
        call: apiCall,

        // Групи методів
        auth,
        user,
        wallet,
        flex,
        daily,
        tasks,
        verify,

        // Утиліти
        cancelAllRequests,
        getStatistics,
        isReady,
        checkServerHealth,

        // Конфігурація
        config,

        // Для сумісності
        initialize
    };

})();

console.log('✅ [TasksAPI] Модуль експортовано глобально (Production)');