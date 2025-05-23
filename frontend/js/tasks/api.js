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
                     ? 'http://localhost:3000/api'
                     : 'https://api.winix.com/api'),
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000
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
        }
    };

    /**
     * Базовий метод для API викликів
     */
    async function apiCall(endpoint, options = {}) {
        console.log('📡 [TasksAPI] === API ВИКЛИК ===');
        console.log('🔗 [TasksAPI] Endpoint:', endpoint);
        console.log('⚙️ [TasksAPI] Options:', options);

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
            defaultOptions.headers['X-Telegram-Data'] = telegramData;
            console.log('📱 [TasksAPI] Додано Telegram дані');
        }

        const finalOptions = mergeOptions(defaultOptions, options);

        console.log('📋 [TasksAPI] Фінальні параметри запиту:', {
            url,
            method: finalOptions.method,
            headers: finalOptions.headers
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

                // Якщо 401 - очищаємо токен
                if (response.status === 401) {
                    console.warn('🔐 [TasksAPI] Токен недійсний, очищаємо');
                    clearAuthToken();
                }

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

        getProfile: async (userId) => {
            console.log('👤 [TasksAPI] Отримання профілю:', userId);
            return apiCall(`/user/profile/${userId}`);
        }
    };

    /**
     * API методи для Wallet
     */
    const wallet = {
        checkStatus: async (userId, address) => {
            console.log('🔍 [TasksAPI] Перевірка статусу гаманця:', userId);
            return apiCall(`/wallet/status/${userId}`, {
                method: 'POST',
                body: JSON.stringify({ address, timestamp: Date.now() })
            });
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

        claim: async (userId, claimData) => {
            console.log('🎁 [TasksAPI] Отримання щоденного бонусу:', userId);
            return apiCall(`/daily/claim/${userId}`, {
                method: 'POST',
                body: JSON.stringify(claimData)
            });
        },

        getHistory: async (userId) => {
            console.log('📜 [TasksAPI] Отримання історії щоденних бонусів:', userId);
            return apiCall(`/daily/history/${userId}`);
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

        claim: async (userId, taskId) => {
            console.log('✅ [TasksAPI] Виконання завдання:', userId, taskId);
            return apiCall(`/tasks/claim/${userId}/${taskId}`, {
                method: 'POST'
            });
        },

        verify: async (userId, taskId, verificationData) => {
            console.log('🔍 [TasksAPI] Верифікація завдання:', userId, taskId);
            return apiCall(`/tasks/verify/${userId}/${taskId}`, {
                method: 'POST',
                body: JSON.stringify(verificationData)
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
        return localStorage.getItem('winix_auth_token');
    }

    function clearAuthToken() {
        localStorage.removeItem('winix_auth_token');
    }

    function getTelegramData() {
        if (window.Telegram?.WebApp?.initData) {
            return window.Telegram.WebApp.initData;
        }
        return null;
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
            pendingRequests: state.pendingRequests.size
        };
    }

    console.log('✅ [TasksAPI] API модуль готовий до використання');

    // Публічний API
    return {
        // Основний метод
        call: apiCall,

        // Групи методів
        user,
        wallet,
        flex,
        daily,
        tasks,

        // Утиліти
        cancelAllRequests,
        getStatistics,

        // Конфігурація
        config
    };

})();

console.log('✅ [TasksAPI] Модуль експортовано глобально');