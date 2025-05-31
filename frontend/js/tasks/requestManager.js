/**
 * Централізований менеджер запитів для системи завдань WINIX
 * Управління чергами, rate limiting та дедуплікація запитів
 */

window.RequestManager = (function() {
    'use strict';

    console.log('🌐 [RequestManager] ===== ІНІЦІАЛІЗАЦІЯ МЕНЕДЖЕРА ЗАПИТІВ =====');

    // Конфігурація
    const config = {
        maxConcurrent: 3,              // Максимум паралельних запитів
        requestTimeout: 30000,         // 30 секунд таймаут
        retryAttempts: 3,             // Кількість спроб
        retryDelay: 1000,             // Базова затримка між спробами
        rateLimitDelay: 1000,         // Мінімальна затримка між запитами
        backoffMultiplier: 1.5,       // Множник для експоненційного backoff
        maxDelay: 60000,              // Максимальна затримка
        deduplicationWindow: 5000     // 5 секунд для дедуплікації
    };

    // Стан менеджера
    const state = {
        activeRequests: new Map(),    // Активні запити
        pendingQueue: [],             // Черга очікування
        rateLimiter: {
            lastRequestTime: 0,
            currentDelay: config.rateLimitDelay,
            tokens: config.maxConcurrent,
            lastRefill: Date.now()
        },
        deduplicationCache: new Map(), // Кеш для дедуплікації
        metrics: {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retriedRequests: 0,
            deduplicatedRequests: 0,
            averageResponseTime: 0
        }
    };

    /**
     * Виконати запит з управлінням чергою та rate limiting
     */
    async function execute(requestId, requestFn, options = {}) {
        const requestOptions = {
            priority: options.priority || 'normal',
            retries: options.retries !== undefined ? options.retries : config.retryAttempts,
            timeout: options.timeout || config.requestTimeout,
            deduplicate: options.deduplicate !== false,
            namespace: options.namespace || 'default'
        };

        console.log(`📤 [RequestManager] Новий запит: ${requestId}`, requestOptions);

        // Перевірка дедуплікації
        if (requestOptions.deduplicate) {
            const cached = checkDeduplication(requestId);
            if (cached) {
                state.metrics.deduplicatedRequests++;
                console.log(`📦 [RequestManager] Повертаємо дедуплікований результат: ${requestId}`);
                return cached;
            }
        }

        // Створюємо об'єкт запиту
        const request = {
            id: requestId,
            fn: requestFn,
            options: requestOptions,
            promise: null,
            resolve: null,
            reject: null,
            startTime: null,
            attempts: 0,
            status: 'pending'
        };

        // Створюємо promise для запиту
        request.promise = new Promise((resolve, reject) => {
            request.resolve = resolve;
            request.reject = reject;
        });

        // Додаємо в чергу з урахуванням пріоритету
        addToQueue(request);

        // Обробляємо чергу
        processQueue();

        return request.promise;
    }

    /**
     * Додати запит в чергу з урахуванням пріоритету
     */
    function addToQueue(request) {
        const priorities = { high: 3, normal: 2, low: 1 };
        const priority = priorities[request.options.priority] || 2;

        // Знаходимо позицію для вставки
        let insertIndex = state.pendingQueue.length;

        for (let i = 0; i < state.pendingQueue.length; i++) {
            const itemPriority = priorities[state.pendingQueue[i].options.priority] || 2;
            if (priority > itemPriority) {
                insertIndex = i;
                break;
            }
        }

        state.pendingQueue.splice(insertIndex, 0, request);
        console.log(`📥 [RequestManager] Додано в чергу на позицію ${insertIndex}: ${request.id}`);
    }

    /**
     * Обробка черги запитів
     */
    async function processQueue() {
        // Перевіряємо чи можемо взяти новий запит
        if (state.activeRequests.size >= config.maxConcurrent || state.pendingQueue.length === 0) {
            return;
        }

        // Перевіряємо rate limit
        if (!checkRateLimit()) {
            // Плануємо повторну спробу
            setTimeout(() => processQueue(), state.rateLimiter.currentDelay);
            return;
        }

        // Беремо наступний запит з черги
        const request = state.pendingQueue.shift();
        if (!request) return;

        // Виконуємо запит
        executeRequest(request);

        // Продовжуємо обробку черги
        if (state.pendingQueue.length > 0) {
            queueMicrotask(() => processQueue());
        }
    }

    /**
     * Перевірка rate limit з token bucket алгоритмом
     */
    function checkRateLimit() {
        const now = Date.now();

        // Поповнюємо токени
        const timeSinceRefill = now - state.rateLimiter.lastRefill;
        const tokensToAdd = Math.floor(timeSinceRefill / state.rateLimiter.currentDelay);

        if (tokensToAdd > 0) {
            state.rateLimiter.tokens = Math.min(
                state.rateLimiter.tokens + tokensToAdd,
                config.maxConcurrent
            );
            state.rateLimiter.lastRefill = now;
        }

        // Перевіряємо чи є токени
        if (state.rateLimiter.tokens > 0) {
            state.rateLimiter.tokens--;
            state.rateLimiter.lastRequestTime = now;
            return true;
        }

        return false;
    }

    /**
     * Виконання конкретного запиту
     */
    async function executeRequest(request) {
        request.status = 'active';
        request.startTime = Date.now();
        request.attempts++;

        state.activeRequests.set(request.id, request);
        state.metrics.totalRequests++;

        console.log(`🚀 [RequestManager] Виконання запиту: ${request.id} (спроба ${request.attempts})`);

        try {
            // Створюємо AbortController для timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, request.options.timeout);

            // Виконуємо запит
            const result = await Promise.race([
                request.fn({ signal: controller.signal }),
                new Promise((_, reject) => {
                    controller.signal.addEventListener('abort', () => {
                        reject(new Error('Request timeout'));
                    });
                })
            ]);

            clearTimeout(timeoutId);

            // Успішне виконання
            handleSuccess(request, result);

        } catch (error) {
            // Обробка помилки
            await handleError(request, error);
        } finally {
            // Видаляємо з активних
            state.activeRequests.delete(request.id);

            // Обробляємо наступний запит з черги
            processQueue();
        }
    }

    /**
     * Обробка успішного запиту
     */
    function handleSuccess(request, result) {
        const responseTime = Date.now() - request.startTime;

        // Оновлюємо метрики
        state.metrics.successfulRequests++;
        updateAverageResponseTime(responseTime);

        // Скидаємо rate limit delay при успіху
        state.rateLimiter.currentDelay = config.rateLimitDelay;

        // Зберігаємо в кеш дедуплікації
        if (request.options.deduplicate) {
            saveToDeduplicationCache(request.id, result);
        }

        request.status = 'completed';
        request.resolve(result);

        console.log(`✅ [RequestManager] Запит успішний: ${request.id} (${responseTime}ms)`);

        // Логуємо в CacheManager якщо потрібно
        if (window.CacheManager && request.options.namespace) {
            window.CacheManager.set(request.options.namespace, request.id, result);
        }
    }

    /**
     * Обробка помилки запиту
     */
    async function handleError(request, error) {
        console.error(`❌ [RequestManager] Помилка запиту ${request.id}:`, error);

        state.metrics.failedRequests++;

        // Перевіряємо чи потрібно повторити
        const shouldRetry = request.attempts < request.options.retries &&
                          !error.message.includes('abort') &&
                          error.status !== 401 &&
                          error.status !== 403;

        if (shouldRetry) {
            // Розраховуємо затримку з експоненційним backoff
            const delay = Math.min(
                config.retryDelay * Math.pow(config.backoffMultiplier, request.attempts - 1),
                config.maxDelay
            );

            console.log(`🔄 [RequestManager] Повторна спроба через ${delay}ms`);

            state.metrics.retriedRequests++;

            // Якщо 429 - збільшуємо rate limit delay
            if (error.status === 429) {
                increaseRateLimitDelay();
            }

            // Чекаємо і повторюємо
            await new Promise(resolve => setTimeout(resolve, delay));

            // Повертаємо в чергу з високим пріоритетом
            request.options.priority = 'high';
            request.status = 'pending';
            addToQueue(request);

        } else {
            // Остаточна помилка
            request.status = 'failed';
            request.reject(error);
        }
    }

    /**
     * Збільшення rate limit delay при 429
     */
    function increaseRateLimitDelay() {
        const newDelay = Math.min(
            state.rateLimiter.currentDelay * config.backoffMultiplier,
            config.maxDelay
        );

        console.warn(`⚠️ [RequestManager] Rate limit hit! Збільшуємо затримку: ${state.rateLimiter.currentDelay}ms → ${newDelay}ms`);

        state.rateLimiter.currentDelay = newDelay;

        // Автоматичне зменшення через хвилину
        setTimeout(() => {
            if (state.rateLimiter.currentDelay > config.rateLimitDelay) {
                state.rateLimiter.currentDelay = Math.max(
                    config.rateLimitDelay,
                    state.rateLimiter.currentDelay / config.backoffMultiplier
                );
                console.log(`📉 [RequestManager] Зменшуємо rate limit delay до ${state.rateLimiter.currentDelay}ms`);
            }
        }, 60000);
    }

    /**
     * Перевірка дедуплікації
     */
    function checkDeduplication(requestId) {
        const cached = state.deduplicationCache.get(requestId);

        if (cached && Date.now() - cached.timestamp < config.deduplicationWindow) {
            console.log(`📦 [RequestManager] Знайдено дедуплікований результат: ${requestId}`);
            return cached.data;
        }

        return null;
    }

    /**
     * Збереження в кеш дедуплікації
     */
    function saveToDeduplicationCache(requestId, data) {
        state.deduplicationCache.set(requestId, {
            data: data,
            timestamp: Date.now()
        });

        // Очищаємо старі записи
        setTimeout(() => {
            state.deduplicationCache.delete(requestId);
        }, config.deduplicationWindow);
    }

    /**
     * Оновлення середнього часу відповіді
     */
    function updateAverageResponseTime(responseTime) {
        const total = state.metrics.successfulRequests;
        const current = state.metrics.averageResponseTime;

        state.metrics.averageResponseTime = ((current * (total - 1)) + responseTime) / total;
    }

    /**
     * Скасувати запит
     */
    function cancel(requestId) {
        // Шукаємо в черзі
        const queueIndex = state.pendingQueue.findIndex(r => r.id === requestId);
        if (queueIndex !== -1) {
            const request = state.pendingQueue.splice(queueIndex, 1)[0];
            request.reject(new Error('Request cancelled'));
            console.log(`🚫 [RequestManager] Скасовано запит в черзі: ${requestId}`);
            return true;
        }

        // Шукаємо в активних
        const activeRequest = state.activeRequests.get(requestId);
        if (activeRequest) {
            activeRequest.reject(new Error('Request cancelled'));
            state.activeRequests.delete(requestId);
            console.log(`🚫 [RequestManager] Скасовано активний запит: ${requestId}`);
            return true;
        }

        return false;
    }

    /**
     * Скасувати всі запити
     */
    function cancelAll(namespace) {
        let cancelled = 0;

        // Скасовуємо в черзі
        if (namespace) {
            state.pendingQueue = state.pendingQueue.filter(request => {
                if (request.options.namespace === namespace) {
                    request.reject(new Error('Request cancelled'));
                    cancelled++;
                    return false;
                }
                return true;
            });
        } else {
            state.pendingQueue.forEach(request => {
                request.reject(new Error('Request cancelled'));
                cancelled++;
            });
            state.pendingQueue = [];
        }

        // Скасовуємо активні
        state.activeRequests.forEach((request, id) => {
            if (!namespace || request.options.namespace === namespace) {
                request.reject(new Error('Request cancelled'));
                state.activeRequests.delete(id);
                cancelled++;
            }
        });

        console.log(`🚫 [RequestManager] Скасовано ${cancelled} запитів`);
        return cancelled;
    }

    /**
     * Отримати статус менеджера
     */
    function getStatus() {
        return {
            activeRequests: state.activeRequests.size,
            pendingRequests: state.pendingQueue.length,
            currentDelay: state.rateLimiter.currentDelay,
            tokens: state.rateLimiter.tokens,
            metrics: { ...state.metrics },
            config: { ...config }
        };
    }

    /**
     * Batch запити
     */
    function batch(requests) {
        console.log(`📦 [RequestManager] Batch запит з ${requests.length} елементами`);

        return Promise.all(
            requests.map(req =>
                execute(req.id, req.fn, { ...req.options, priority: 'high' })
            )
        );
    }

    /**
     * Створити спеціалізований клієнт для namespace
     */
    function createClient(namespace, defaultOptions = {}) {
        return {
            execute: (id, fn, options = {}) =>
                execute(id, fn, { ...defaultOptions, ...options, namespace }),

            cancel: (id) => cancel(id),

            cancelAll: () => cancelAll(namespace),

            batch: (requests) =>
                batch(requests.map(r => ({ ...r, options: { ...r.options, namespace } })))
        };
    }

    /**
     * Очистити всі дані
     */
    function clear() {
        // Скасовуємо всі запити
        cancelAll();

        // Очищаємо кеші
        state.deduplicationCache.clear();

        // Скидаємо метрики
        state.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retriedRequests: 0,
            deduplicatedRequests: 0,
            averageResponseTime: 0
        };

        console.log('✅ [RequestManager] Менеджер очищено');
    }

    console.log('✅ [RequestManager] Менеджер запитів готовий до роботи');

    // Публічний API
    return {
        execute,
        cancel,
        cancelAll,
        getStatus,
        batch,
        createClient,
        clear,

        // Налаштування конфігурації
        configure: (newConfig) => {
            Object.assign(config, newConfig);
            console.log('⚙️ [RequestManager] Конфігурація оновлена:', config);
        }
    };
})();

console.log('✅ [RequestManager] Модуль експортовано глобально');