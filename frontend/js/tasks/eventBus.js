/**
 * Event Bus для системи завдань WINIX
 * Централізована система подій для комунікації між модулями
 */

window.EventBus = (function() {
    'use strict';

    console.log('📢 [EventBus] ===== ІНІЦІАЛІЗАЦІЯ СИСТЕМИ ПОДІЙ =====');

    // Сховище слухачів
    const listeners = new Map();
    const onceListeners = new Map();

    // Історія подій для відладки
    const eventHistory = [];
    const maxHistorySize = 100;

    // Конфігурація
    const config = {
        asyncEvents: true,           // Виконувати слухачів асинхронно
        errorHandling: true,         // Ловити помилки в слухачах
        wildcardSupport: true,       // Підтримка wildcard подій (*)
        debugging: false,            // Режим відладки
        performanceTracking: true    // Відстеження продуктивності
    };

    // Метрики
    const metrics = {
        totalEvents: 0,
        totalListeners: 0,
        eventCounts: new Map(),
        listenerExecutionTime: new Map()
    };

    /**
     * Підписатись на подію
     */
    function on(event, callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new TypeError('Callback must be a function');
        }

        const listener = {
            callback,
            options: {
                priority: options.priority || 0,
                context: options.context || null,
                once: options.once || false,
                namespace: options.namespace || 'default'
            }
        };

        // Додаємо слухача
        if (!listeners.has(event)) {
            listeners.set(event, []);
        }

        const eventListeners = listeners.get(event);

        // Вставляємо з урахуванням пріоритету
        let inserted = false;
        for (let i = 0; i < eventListeners.length; i++) {
            if (listener.options.priority > eventListeners[i].options.priority) {
                eventListeners.splice(i, 0, listener);
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            eventListeners.push(listener);
        }

        metrics.totalListeners++;

        if (config.debugging) {
            console.log(`📌 [EventBus] Додано слухач для "${event}"`, listener.options);
        }

        // Повертаємо функцію відписки
        return function unsubscribe() {
            off(event, callback);
        };
    }

    /**
     * Підписатись на подію один раз
     */
    function once(event, callback, options = {}) {
        return on(event, callback, { ...options, once: true });
    }

    /**
     * Відписатись від події
     */
    function off(event, callback) {
        if (!event) {
            // Видалити всі слухачі
            listeners.clear();
            metrics.totalListeners = 0;
            return;
        }

        if (!callback) {
            // Видалити всі слухачі для події
            const count = listeners.get(event)?.length || 0;
            listeners.delete(event);
            metrics.totalListeners -= count;
            return;
        }

        // Видалити конкретний слухач
        const eventListeners = listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.findIndex(l => l.callback === callback);
            if (index !== -1) {
                eventListeners.splice(index, 1);
                metrics.totalListeners--;

                if (eventListeners.length === 0) {
                    listeners.delete(event);
                }
            }
        }
    }

    /**
     * Відписати всі слухачі namespace
     */
    function offNamespace(namespace) {
        let removed = 0;

        listeners.forEach((eventListeners, event) => {
            const filtered = eventListeners.filter(listener => {
                if (listener.options.namespace === namespace) {
                    removed++;
                    return false;
                }
                return true;
            });

            if (filtered.length === 0) {
                listeners.delete(event);
            } else {
                listeners.set(event, filtered);
            }
        });

        metrics.totalListeners -= removed;

        console.log(`🗑️ [EventBus] Видалено ${removed} слухачів для namespace "${namespace}"`);
        return removed;
    }

    /**
     * Викликати подію
     */
    async function emit(event, data = {}, options = {}) {
        const startTime = performance.now();

        // Додаємо в історію
        addToHistory(event, data);

        // Оновлюємо метрики
        metrics.totalEvents++;
        metrics.eventCounts.set(event, (metrics.eventCounts.get(event) || 0) + 1);

        if (config.debugging) {
            console.log(`📤 [EventBus] Емітуємо подію "${event}"`, data);
        }

        // Збираємо всіх слухачів (включаючи wildcard)
        const eventListeners = [];

        // Точні слухачі
        if (listeners.has(event)) {
            eventListeners.push(...listeners.get(event));
        }

        // Wildcard слухачі
        if (config.wildcardSupport) {
            listeners.forEach((wildcardListeners, wildcardEvent) => {
                if (wildcardEvent.includes('*') && matchWildcard(event, wildcardEvent)) {
                    eventListeners.push(...wildcardListeners);
                }
            });
        }

        if (eventListeners.length === 0) {
            if (config.debugging) {
                console.log(`📭 [EventBus] Немає слухачів для "${event}"`);
            }
            return;
        }

        // Створюємо контекст події
        const eventContext = {
            event,
            data,
            timestamp: Date.now(),
            cancelled: false,
            stopPropagation: function() {
                this.cancelled = true;
            }
        };

        // Виконуємо слухачів
        const results = [];

        for (const listener of eventListeners) {
            if (eventContext.cancelled) break;

            try {
                const listenerStartTime = performance.now();

                // Виконуємо callback
                let result;
                if (config.asyncEvents || options.async) {
                    result = await executeAsync(listener, eventContext);
                } else {
                    result = executeSync(listener, eventContext);
                }

                results.push(result);

                // Відстежуємо час виконання
                if (config.performanceTracking) {
                    const executionTime = performance.now() - listenerStartTime;
                    trackListenerPerformance(event, listener, executionTime);
                }

                // Видаляємо once слухачів
                if (listener.options.once) {
                    off(event, listener.callback);
                }

            } catch (error) {
                if (config.errorHandling) {
                    console.error(`❌ [EventBus] Помилка в слухачі для "${event}":`, error);
                    results.push({ error });
                } else {
                    throw error;
                }
            }
        }

        // Відстежуємо загальний час
        const totalTime = performance.now() - startTime;
        if (config.performanceTracking && totalTime > 10) {
            console.warn(`⚠️ [EventBus] Повільна подія "${event}": ${totalTime.toFixed(2)}ms`);
        }

        return results;
    }

    /**
     * Синхронне виконання слухача
     */
    function executeSync(listener, eventContext) {
        const context = listener.options.context || eventContext;
        return listener.callback.call(context, eventContext.data, eventContext);
    }

    /**
     * Асинхронне виконання слухача
     */
    async function executeAsync(listener, eventContext) {
        return new Promise((resolve, reject) => {
            queueMicrotask(() => {
                try {
                    const context = listener.options.context || eventContext;
                    const result = listener.callback.call(context, eventContext.data, eventContext);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Перевірка wildcard паттерну
     */
    function matchWildcard(event, pattern) {
        const eventParts = event.split('.');
        const patternParts = pattern.split('.');

        if (patternParts.length !== eventParts.length && !pattern.endsWith('*')) {
            return false;
        }

        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i] === '*') continue;
            if (patternParts[i] !== eventParts[i]) return false;
        }

        return true;
    }

    /**
     * Додати подію в історію
     */
    function addToHistory(event, data) {
        eventHistory.push({
            event,
            data: config.debugging ? data : undefined,
            timestamp: Date.now()
        });

        if (eventHistory.length > maxHistorySize) {
            eventHistory.shift();
        }
    }

    /**
     * Відстеження продуктивності слухача
     */
    function trackListenerPerformance(event, listener, executionTime) {
        const key = `${event}:${listener.callback.name || 'anonymous'}`;

        if (!metrics.listenerExecutionTime.has(key)) {
            metrics.listenerExecutionTime.set(key, {
                count: 0,
                total: 0,
                average: 0,
                max: 0
            });
        }

        const stats = metrics.listenerExecutionTime.get(key);
        stats.count++;
        stats.total += executionTime;
        stats.average = stats.total / stats.count;
        stats.max = Math.max(stats.max, executionTime);
    }

    /**
     * Очікувати на подію
     */
    function waitFor(event, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                off(event, handler);
                reject(new Error(`Timeout waiting for event: ${event}`));
            }, timeout);

            const handler = (data) => {
                clearTimeout(timer);
                resolve(data);
            };

            once(event, handler);
        });
    }

    /**
     * Створити namespaced емітер
     */
    function createNamespace(namespace) {
        return {
            on: (event, callback, options = {}) =>
                on(event, callback, { ...options, namespace }),

            once: (event, callback, options = {}) =>
                once(event, callback, { ...options, namespace }),

            off: (event, callback) => off(event, callback),

            emit: (event, data, options) => emit(event, data, options),

            clear: () => offNamespace(namespace)
        };
    }

    /**
     * Отримати статистику
     */
    function getStats() {
        const topEvents = Array.from(metrics.eventCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const slowestListeners = Array.from(metrics.listenerExecutionTime.entries())
            .sort((a, b) => b[1].average - a[1].average)
            .slice(0, 10)
            .map(([key, stats]) => ({ listener: key, ...stats }));

        return {
            totalEvents: metrics.totalEvents,
            totalListeners: metrics.totalListeners,
            uniqueEvents: listeners.size,
            topEvents,
            slowestListeners,
            recentEvents: eventHistory.slice(-10)
        };
    }

    /**
     * Очистити всі дані
     */
    function clear() {
        listeners.clear();
        eventHistory.length = 0;
        metrics.totalEvents = 0;
        metrics.totalListeners = 0;
        metrics.eventCounts.clear();
        metrics.listenerExecutionTime.clear();

        console.log('✅ [EventBus] Всі слухачі та історія очищені');
    }

    /**
     * Налагодження - показати всі слухачі
     */
    function debug() {
        console.group('🔍 [EventBus] Debug Info');
        console.log('Listeners:', listeners);
        console.log('Stats:', getStats());
        console.log('Config:', config);
        console.groupEnd();
    }

    // Попередньо визначені події системи
    const EVENTS = {
        // Користувач
        USER_LOGGED_IN: 'user.logged_in',
        USER_LOGGED_OUT: 'user.logged_out',
        USER_UPDATED: 'user.updated',

        // Баланс
        BALANCE_UPDATED: 'balance.updated',
        BALANCE_INSUFFICIENT: 'balance.insufficient',

        // Гаманець
        WALLET_CONNECTED: 'wallet.connected',
        WALLET_DISCONNECTED: 'wallet.disconnected',
        WALLET_BALANCE_UPDATED: 'wallet.balance_updated',

        // Завдання
        TASK_STARTED: 'task.started',
        TASK_COMPLETED: 'task.completed',
        TASK_FAILED: 'task.failed',
        TASK_CLAIMED: 'task.claimed',

        // Daily Bonus
        DAILY_CLAIMED: 'daily.claimed',
        DAILY_STREAK_UPDATED: 'daily.streak_updated',
        DAILY_RESET: 'daily.reset',

        // Flex
        FLEX_BALANCE_UPDATED: 'flex.balance_updated',
        FLEX_LEVEL_CLAIMED: 'flex.level_claimed',
        FLEX_LEVEL_AVAILABLE: 'flex.level_available',

        // Система
        APP_READY: 'app.ready',
        APP_ERROR: 'app.error',
        NETWORK_ONLINE: 'network.online',
        NETWORK_OFFLINE: 'network.offline',

        // UI
        TAB_CHANGED: 'ui.tab_changed',
        MODAL_OPENED: 'ui.modal_opened',
        MODAL_CLOSED: 'ui.modal_closed',
        LOADING_START: 'ui.loading_start',
        LOADING_END: 'ui.loading_end'
    };

    console.log('✅ [EventBus] Система подій готова до роботи');

    // Публічний API
    return {
        on,
        once,
        off,
        offNamespace,
        emit,
        waitFor,
        createNamespace,
        getStats,
        clear,
        debug,
        EVENTS,

        // Конфігурація
        configure: (options) => {
            Object.assign(config, options);
            console.log('⚙️ [EventBus] Конфігурація оновлена:', config);
        }
    };
})();

console.log('✅ [EventBus] Модуль експортовано глобально');