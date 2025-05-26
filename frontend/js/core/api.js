/**
 * api-optimized.js - Швидкий і надійний API модуль для WINIX
 * Оптимізований для instant UI updates і smart caching
 */

class WinixAPI {
    constructor() {
        this.baseURL = this.detectBaseURL();
        this.requestQueue = new Map();
        this.retryQueue = new Set();
        this.interceptors = { request: [], response: [] };

        // Performance tracking
        this.metrics = {
            requests: 0,
            errors: 0,
            avgResponseTime: 0,
            cache_hits: 0
        };

        // Request deduplication
        this.pendingRequests = new Map();

        // Circuit breaker pattern
        this.circuitBreaker = {
            failures: 0,
            threshold: 5,
            timeout: 30000,
            state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
        };

        this.initializeInterceptors();
    }

    detectBaseURL() {
        const hostname = window.location.hostname;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `http://${hostname}:8080`;
        }

        return 'https://winixbot.com';
    }

    initializeInterceptors() {
        // Request interceptor - додає auth headers
        this.addRequestInterceptor((config) => {
            const token = this.getAuthToken();
            const userId = this.getUserId();

            if (token) {
                config.headers = config.headers || {};
                config.headers['Authorization'] = `Bearer ${token}`;
            }

            if (userId) {
                config.headers = config.headers || {};
                config.headers['X-Telegram-User-Id'] = userId;
            }

            return config;
        });

        // Response interceptor - обробляє помилки авторизації
        this.addResponseInterceptor(
            (response) => response,
            async (error) => {
                if (error.status === 401) {
                    try {
                        await this.refreshToken();
                        return this.retry(error.config);
                    } catch (refreshError) {
                        window.WinixState?.emit('authError', refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    // Smart request deduplication
    async request(endpoint, options = {}) {
        const config = {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
            cache: true,
            optimistic: false,
            ...options
        };

        // Create request key for deduplication
        const requestKey = this.createRequestKey(endpoint, config);

        // Check for pending identical request
        if (this.pendingRequests.has(requestKey)) {
            return this.pendingRequests.get(requestKey);
        }

        // Check circuit breaker
        if (!this.isCircuitBreakerOpen()) {
            const promise = this.executeRequest(endpoint, config);
            this.pendingRequests.set(requestKey, promise);

            promise.finally(() => {
                this.pendingRequests.delete(requestKey);
            });

            return promise;
        } else {
            throw new Error('Circuit breaker is open');
        }
    }

    async executeRequest(endpoint, config) {
        const startTime = performance.now();
        this.metrics.requests++;

        try {
            // Apply request interceptors
            config = await this.applyRequestInterceptors(config);

            // Check cache first
            if (config.cache && config.method === 'GET') {
                const cached = window.WinixState?.getCache(endpoint);
                if (cached) {
                    this.metrics.cache_hits++;
                    return cached;
                }
            }

            // Optimistic update
            if (config.optimistic && window.WinixState) {
                this.handleOptimisticUpdate(endpoint, config);
            }

            // Execute request
            const response = await this.fetchWithTimeout(
                `${this.baseURL}/api/${endpoint.replace(/^\/+/, '')}`,
                config
            );

            // Handle response
            const result = await this.handleResponse(response, config);

            // Update metrics
            const responseTime = performance.now() - startTime;
            this.updateMetrics(responseTime, true);

            // Cache successful GET requests
            if (config.cache && config.method === 'GET' && result.status === 'success') {
                window.WinixState?.setCache(endpoint, result, config.cacheTTL);
            }

            // Update state
            this.updateStateFromResponse(endpoint, result, config);

            return result;

        } catch (error) {
            this.updateMetrics(performance.now() - startTime, false);
            this.handleCircuitBreaker(error);

            // Apply response interceptors
            throw await this.applyResponseInterceptors(null, error);
        }
    }

    // Optimistic updates для instant UI
    handleOptimisticUpdate(endpoint, config) {
        if (endpoint.includes('balance') && config.method === 'POST') {
            const amount = config.body?.amount || 0;
            const currentCoins = window.WinixState?.coins || 0;

            // Instantly update UI
            window.WinixState?.optimisticUpdate('coins', currentCoins + amount, 'apiError');
        }

        if (endpoint.includes('staking') && config.method === 'POST') {
            window.WinixState?.optimisticUpdate('loading', false);
            window.showNotification?.('Стейкінг створюється...', false);
        }
    }

    // Smart state updates
    updateStateFromResponse(endpoint, result, config) {
        if (!window.WinixState || result.status !== 'success') return;

        const data = result.data;

        // User data updates
        if (endpoint.includes('user/') && !endpoint.includes('balance')) {
            if (data.telegram_id) window.WinixState.user = data;
            if (data.balance !== undefined) window.WinixState.balance = data.balance;
            if (data.coins !== undefined) window.WinixState.coins = data.coins;
        }

        // Balance specific updates
        if (endpoint.includes('balance')) {
            if (data.coins !== undefined) window.WinixState.coins = data.coins;
            if (data.balance !== undefined) window.WinixState.balance = data.balance;
        }

        // Staking updates
        if (endpoint.includes('staking')) {
            window.WinixState.emit('stakingUpdated', data);
        }
    }

    async fetchWithTimeout(url, config) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        try {
            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    async handleResponse(response, config) {
        if (!response.ok) {
            const errorData = await response.text();
            let errorMessage;

            try {
                const errorJson = JSON.parse(errorData);
                errorMessage = errorJson.message || `HTTP ${response.status}`;
            } catch {
                errorMessage = `HTTP ${response.status}`;
            }

            const error = new Error(errorMessage);
            error.status = response.status;
            error.config = config;
            throw error;
        }

        return await response.json();
    }

    // Circuit breaker implementation
    isCircuitBreakerOpen() {
        return this.circuitBreaker.state === 'OPEN' &&
               Date.now() < this.circuitBreaker.nextAttempt;
    }

    handleCircuitBreaker(error) {
        if (error.name === 'AbortError' || error.status >= 500) {
            this.circuitBreaker.failures++;

            if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
                this.circuitBreaker.state = 'OPEN';
                this.circuitBreaker.nextAttempt = Date.now() + this.circuitBreaker.timeout;

                window.WinixState?.emit('circuitBreakerOpen');
                console.warn('🔴 API Circuit Breaker OPEN');
            }
        }
    }

    updateMetrics(responseTime, success) {
        if (success) {
            this.circuitBreaker.failures = 0;
            this.circuitBreaker.state = 'CLOSED';
        } else {
            this.metrics.errors++;
        }

        // Moving average for response time
        this.metrics.avgResponseTime =
            (this.metrics.avgResponseTime * 0.9) + (responseTime * 0.1);
    }

    // Interceptors
    addRequestInterceptor(interceptor) {
        this.interceptors.request.push(interceptor);
    }

    addResponseInterceptor(success, error) {
        this.interceptors.response.push({ success, error });
    }

    async applyRequestInterceptors(config) {
        for (const interceptor of this.interceptors.request) {
            config = await interceptor(config);
        }
        return config;
    }

    async applyResponseInterceptors(response, error) {
        for (const { success, error: errorHandler } of this.interceptors.response) {
            if (error && errorHandler) {
                try {
                    return await errorHandler(error);
                } catch (e) {
                    error = e;
                }
            } else if (response && success) {
                response = await success(response);
            }
        }

        if (error) throw error;
        return response;
    }

    createRequestKey(endpoint, config) {
        return `${config.method}:${endpoint}:${JSON.stringify(config.body || {})}`;
    }

    // Utility methods
    getUserId() {
        return window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() ||
               localStorage.getItem('telegram_user_id');
    }

    getAuthToken() {
        return localStorage.getItem('auth_token');
    }

    async refreshToken() {
        const userId = this.getUserId();
        if (!userId) throw new Error('No user ID for token refresh');

        const response = await this.request('auth/refresh', {
            method: 'POST',
            body: { telegram_id: userId },
            cache: false
        });

        if (response.status === 'success' && response.token) {
            localStorage.setItem('auth_token', response.token);
            window.WinixState?.emit('tokenRefreshed', response.token);
        }

        return response;
    }

    async retry(config) {
        return this.executeRequest(config.endpoint, config);
    }

    // High-level API methods
    async getUserData(forceRefresh = false) {
        const userId = this.getUserId();
        if (!userId) throw new Error('No user ID');

        return this.request(`user/${userId}`, {
            cache: !forceRefresh,
            cacheTTL: 300000 // 5 minutes
        });
    }

    async getBalance() {
        const userId = this.getUserId();
        if (!userId) throw new Error('No user ID');

        return this.request(`user/${userId}/balance`, {
            cache: true,
            cacheTTL: 30000 // 30 seconds
        });
    }

    async updateBalance(amount, operation = 'add') {
        const userId = this.getUserId();
        if (!userId) throw new Error('No user ID');

        return this.request(`user/${userId}/balance`, {
            method: 'POST',
            body: { amount, operation },
            optimistic: true,
            cache: false
        });
    }

    async createStaking(amount, period) {
        const userId = this.getUserId();
        if (!userId) throw new Error('No user ID');

        return this.request(`user/${userId}/staking`, {
            method: 'POST',
            body: { stakingAmount: amount, period },
            cache: false
        });
    }

    // Performance monitoring
    getMetrics() {
        return {
            ...this.metrics,
            circuitBreaker: this.circuitBreaker.state,
            pendingRequests: this.pendingRequests.size
        };
    }
}

// Initialize global instance
window.WinixAPI = new WinixAPI();

// Auto-connect with state manager
if (window.WinixState) {
    window.WinixAPI.addResponseInterceptor(
        (response) => {
            window.WinixState.connected = true;
            return response;
        },
        (error) => {
            if (error.name === 'TypeError') {
                window.WinixState.connected = false;
            }
            throw error;
        }
    );
}

console.log('✅ WinixAPI: Оптимізований API модуль ініціалізовано');