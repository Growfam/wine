/**
 * API модуль для системи завдань WINIX
 * Централізоване управління всіма API викликами
 */

window.TasksAPI = (function() {
    'use strict';

    console.log('🌐 [TasksAPI] ===== ІНІЦІАЛІЗАЦІЯ API МОДУЛЯ =====');

    // Конфігурація
    const config = {
       baseURL: window.TasksConstants?.API_ENDPOINTS?.BASE_URL ||
         (window.location.hostname === 'localhost'
             ? 'http://localhost:8080/api'
             : '/api'),
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000
    };

    console.log('⚙️ [TasksAPI] Конфігурація:', config);

    // Перевірка чи використовувати Mock API
const USE_MOCK_API = window.location.hostname === 'localhost' || !window.TasksConstants?.API_ENDPOINTS?.BASE_URL;

if (USE_MOCK_API) {
    console.warn('⚠️ [TasksAPI] Використовується Mock API для тестування');
}

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
            maxRequests: window.TasksConstants?.SECURITY?.RATE_LIMIT?.MAX_REQUESTS || 20
        }
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
     * Базовий метод для API викликів
     */
    async function apiCall(endpoint, options = {}) {
    console.log('📡 [TasksAPI] === API ВИКЛИК ===');
    console.log('🔗 [TasksAPI] Endpoint:', endpoint);

    // Використовуємо Mock API якщо потрібно
    if (USE_MOCK_API && window.MockAPI) {
        console.log('🎭 [TasksAPI] Перенаправлення на Mock API');

        // Мапінг endpoints на mock функції
        const mockMap = {
            '/auth/validate-telegram': 'validateTelegram',
            '/user/profile/': 'getProfile',
            '/user/balance/': 'getBalance',
            '/daily/status/': 'getDailyStatus',
            '/daily/claim/': 'claimDailyBonus',
            '/tasks/list/': 'getTasks',
            '/wallet/status/': 'getWalletStatus',
            '/flex/balance/': 'getFlexBalance'
        };

        // Знаходимо відповідну mock функцію
        let mockFunction = null;
        for (const [pattern, funcName] of Object.entries(mockMap)) {
            if (endpoint.includes(pattern)) {
                mockFunction = window.MockAPI[funcName];
                break;
            }
        }

        if (mockFunction) {
            try {
                const result = await mockFunction();
                console.log('✅ [TasksAPI] Mock відповідь:', result);
                return result;
            } catch (error) {
                console.error('❌ [TasksAPI] Mock помилка:', error);
                throw error;
            }
        }
    }
        console.log('📡 [TasksAPI] === API ВИКЛИК ===');
        console.log('🔗 [TasksAPI] Endpoint:', endpoint);
        console.log('⚙️ [TasksAPI] Options:', options);

        // Перевіряємо rate limit
        try {
            checkRateLimit();
        } catch (error) {
            window.TasksUtils?.showToast(error.message, 'error');
            throw error;
        }

        const url = config.baseURL + endpoint;
        const requestId = generateRequestId();

        // Зберігаємо інформацію про запит
        state.pendingRequests.set(requestId, {
            endpoint,
            startTime: Date.now(),
            status: 'pending'
        });

        // Налаштування за замовчуванням
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Request-ID': requestId
            }
        };

        // Додаємо токен авторизації якщо є
        const authToken = getAuthToken();
        if (authToken) {
            defaultOptions.headers['Authorization'] = `Bearer ${authToken}`;
            console.log('🔐 [TasksAPI] Додано токен авторизації');
        }

        // Додаємо Telegram дані якщо є
        const telegramData = getTelegramData();
        if (telegramData) {
            defaultOptions.headers['X-Telegram-Init-Data'] = telegramData;
            console.log('📱 [TasksAPI] Додано Telegram дані');
        }

        const finalOptions = mergeOptions(defaultOptions, options);

        console.log('📋 [TasksAPI] Фінальні параметри запиту:', {
            url,
            method: finalOptions.method,
            headers: { ...finalOptions.headers, Authorization: '[HIDDEN]' }
        });

        try {
            // Виконуємо запит з retry логікою
            const response = await fetchWithRetry(url, finalOptions, requestId);

            // Оновлюємо статистику
            updateRequestStats(requestId, true, response);

            console.log('✅ [TasksAPI] Успішна відповідь:', response);
            return response;

        } catch (error) {
            // Оновлюємо статистику
            updateRequestStats(requestId, false, error);

            console.error('❌ [TasksAPI] Помилка запиту:', error);

            // Якщо помилка авторизації - очищаємо токен
            if (error.status === 401) {
                handleAuthError();
            }

            throw error;

        } finally {
            // Видаляємо запит зі списку активних
            state.pendingRequests.delete(requestId);
        }
    }

    /**
     * Fetch з retry логікою
     */
    async function fetchWithRetry(url, options, requestId, attempt = 1) {
        console.log(`🔄 [TasksAPI] Спроба ${attempt}/${config.retryAttempts}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.timeout);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const responseTime = Date.now() - state.pendingRequests.get(requestId).startTime;
            console.log(`⏱️ [TasksAPI] Час відповіді: ${responseTime}мс`);

            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    message: `HTTP ${response.status} ${response.statusText}`
                }));

                console.error('❌ [TasksAPI] Помилка HTTP:', error);

                throw new APIError(error.message || 'API Error', response.status, error);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.error(`❌ [TasksAPI] Помилка спроби ${attempt}:`, error);

            // Якщо це timeout або мережева помилка і є ще спроби
            if (attempt < config.retryAttempts && shouldRetry(error)) {
                console.log(`⏳ [TasksAPI] Затримка ${config.retryDelay}мс перед повтором`);
                await delay(config.retryDelay * attempt);
                return fetchWithRetry(url, options, requestId, attempt + 1);
            }

            throw error;
        }
    }

    /**
     * API методи для User
     */
    const user = {
        getProfile: async (userId) => {
            console.log('👤 [TasksAPI] Отримання профілю:', userId);
            return apiCall(`/user/profile/${userId}`);
        },

        getBalance: async (userId) => {
            console.log('💰 [TasksAPI] Отримання балансу користувача:', userId);
            return apiCall(`/user/balance/${userId}`);
        },

        updateBalance: async (userId, balances) => {
            console.log('💰 [TasksAPI] Оновлення балансу:', userId, balances);
            return apiCall(`/user/update-balance/${userId}`, {
                method: 'POST',
                body: JSON.stringify(balances)
            });
        },

        getStats: async (userId) => {
            console.log('📊 [TasksAPI] Отримання статистики:', userId);
            return apiCall(`/user/stats/${userId}`);
        }
    };

    /**
     * API методи для Auth
     */
    const auth = {
        validateTelegram: async (initData) => {
            console.log('🔐 [TasksAPI] Валідація Telegram даних');
            return apiCall('/auth/validate-telegram', {
                method: 'POST',
                body: JSON.stringify({ initData, timestamp: Date.now() })
            });
        },

        refreshToken: async () => {
            console.log('🔄 [TasksAPI] Оновлення токену');
            return apiCall('/auth/refresh-token', {
                method: 'POST'
            });
        }
    };

    /**
     * API методи для Wallet
     */
    const wallet = {
        checkStatus: async (userId) => {
            console.log('🔍 [TasksAPI] Перевірка статусу гаманця:', userId);
            return apiCall(`/wallet/status/${userId}`);
        },

        connect: async (userId, walletData) => {
            console.log('🔌 [TasksAPI] Підключення гаманця:', userId);
            return apiCall(`/wallet/connect/${userId}`, {
                method: 'POST',
                body: JSON.stringify(walletData)
            });
        },

        disconnect: async (userId) => {
            console.log('🔌 [TasksAPI] Відключення гаманця:', userId);
            return apiCall(`/wallet/disconnect/${userId}`, {
                method: 'POST'
            });
        },

        verify: async (userId, address) => {
            console.log('✅ [TasksAPI] Верифікація гаманця:', userId);
            return apiCall(`/wallet/verify/${userId}`, {
                method: 'POST',
                body: JSON.stringify({ address, timestamp: Date.now() })
            });
        }
    };

    /**
     * API методи для Flex
     */
    const flex = {
        getBalance: async (userId, walletAddress) => {
            console.log('💎 [TasksAPI] Отримання балансу FLEX:', userId);
            return apiCall(`/flex/balance/${userId}`, {
                headers: {
                    'X-Wallet-Address': walletAddress
                }
            });
        },

        claimReward: async (userId, level) => {
            console.log('🎁 [TasksAPI] Отримання винагороди FLEX:', userId, level);
            return apiCall(`/flex/claim-reward/${userId}/${level}`, {
                method: 'POST',
                body: JSON.stringify({ timestamp: Date.now() })
            });
        },

        getHistory: async (userId) => {
            console.log('📜 [TasksAPI] Отримання історії FLEX:', userId);
            return apiCall(`/flex/history/${userId}`);
        },

        checkLevels: async (userId, flexBalance) => {
            console.log('🎯 [TasksAPI] Перевірка доступних рівнів:', userId);
            return apiCall(`/flex/check-levels/${userId}`, {
                method: 'POST',
                body: JSON.stringify({ flexBalance })
            });
        }
    };

    /**
     * API методи для Daily Bonus
     */
    const daily = {
        getStatus: async (userId) => {
            console.log('📅 [TasksAPI] Отримання статусу щоденного бонусу:', userId);
            return apiCall(`/daily/status/${userId}`);
        },

        claim: async (userId) => {
            console.log('🎁 [TasksAPI] Отримання щоденного бонусу:', userId);
            return apiCall(`/daily/claim/${userId}`, {
                method: 'POST',
                body: JSON.stringify({ timestamp: Date.now() })
            });
        },

        getHistory: async (userId) => {
            console.log('📜 [TasksAPI] Отримання історії щоденних бонусів:', userId);
            return apiCall(`/daily/history/${userId}`);
        },

        calculateReward: async (userId, dayNumber) => {
            console.log('💰 [TasksAPI] Розрахунок винагороди:', userId, dayNumber);
            return apiCall(`/daily/calculate-reward/${userId}`, {
                method: 'POST',
                body: JSON.stringify({ dayNumber })
            });
        }
    };

    /**
     * API методи для Tasks
     */
    const tasks = {
        getList: async (userId, type = 'all') => {
            console.log('📋 [TasksAPI] Отримання списку завдань:', userId, type);
            return apiCall(`/tasks/list/${userId}?type=${type}`);
        },

        start: async (userId, taskId) => {
            console.log('▶️ [TasksAPI] Початок виконання завдання:', userId, taskId);
            return apiCall(`/tasks/start/${userId}/${taskId}`, {
                method: 'POST',
                body: JSON.stringify({ timestamp: Date.now() })
            });
        },

        verify: async (userId, taskId, verificationData) => {
            console.log('🔍 [TasksAPI] Верифікація завдання:', userId, taskId);
            return apiCall(`/tasks/verify/${userId}/${taskId}`, {
                method: 'POST',
                body: JSON.stringify(verificationData)
            });
        },

        complete: async (userId, taskId) => {
            console.log('✅ [TasksAPI] Завершення завдання:', userId, taskId);
            return apiCall(`/tasks/complete/${userId}/${taskId}`, {
                method: 'POST',
                body: JSON.stringify({ timestamp: Date.now() })
            });
        },

        claim: async (userId, taskId) => {
            console.log('💰 [TasksAPI] Отримання винагороди за завдання:', userId, taskId);
            return apiCall(`/tasks/claim/${userId}/${taskId}`, {
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
            return apiCall(`/verify/telegram/${userId}`, {
                method: 'POST',
                body: JSON.stringify({ channelUsername })
            });
        },

        checkBot: async (userId) => {
            console.log('🤖 [TasksAPI] Перевірка запуску бота:', userId);
            return apiCall(`/verify/check-bot/${userId}`);
        },

        social: async (userId, platform, data) => {
            console.log('🌐 [TasksAPI] Верифікація соціальної мережі:', userId, platform);
            return apiCall(`/verify/social/${userId}/${platform}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
    };

    /**
     * Допоміжні функції
     */
    function generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    function getAuthToken() {
        return window.TelegramValidator?.getAuthToken() ||
               sessionStorage.getItem(window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN);
    }

    function clearAuthToken() {
        window.TelegramValidator?.clearAuthToken();
        sessionStorage.removeItem(window.TasksConstants?.STORAGE_KEYS?.AUTH_TOKEN);
    }

    function getTelegramData() {
        const telegramData = window.TelegramValidator?.getTelegramData();
        if (telegramData?.initData) {
            return telegramData.initData;
        }
        return null;
    }

    function handleAuthError() {
        console.warn('🔐 [TasksAPI] Помилка авторизації, очищаємо токен');
        clearAuthToken();

        // Показуємо повідомлення
        window.TasksUtils?.showToast('Сесія закінчилася. Оновіть сторінку', 'error');

        // Оновлюємо сторінку через 2 секунди
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }

    function mergeOptions(defaults, custom) {
        return {
            ...defaults,
            ...custom,
            headers: {
                ...defaults.headers,
                ...custom.headers
            }
        };
    }

    function shouldRetry(error) {
        // Retry на мережеві помилки та таймаути
        // Не робимо retry для 4xx помилок (клієнтські помилки)
        if (error.status && error.status >= 400 && error.status < 500) {
            return false;
        }

        return error.name === 'AbortError' ||
               error.name === 'TypeError' ||
               error.message.includes('NetworkError') ||
               error.message.includes('Failed to fetch');
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
            rateLimitRemaining: state.rateLimiter.maxRequests - state.rateLimiter.requests.length
        };
    }

    console.log('✅ [TasksAPI] API модуль готовий до використання');

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

        // Конфігурація
        config
    };

})();

console.log('✅ [TasksAPI] Модуль експортовано глобально');