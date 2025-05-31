
/**
 * Централізований менеджер кешу для системи завдань WINIX
 * Єдина точка управління кешуванням для усунення дублювання
 */

window.CacheManager = (function() {
    'use strict';

    console.log('💾 [CacheManager] ===== ІНІЦІАЛІЗАЦІЯ ЦЕНТРАЛІЗОВАНОГО КЕШУ =====');

    // Конфігурація TTL для різних типів даних
    const TTL_CONFIG = {
        // API дані
        userProfile: 5 * 60 * 1000,      // 5 хвилин
        balance: 30 * 1000,              // 30 секунд
        tasks: 2 * 60 * 1000,            // 2 хвилини
        walletStatus: 60 * 1000,         // 1 хвилина
        dailyStatus: 60 * 1000,          // 1 хвилина
        flexBalance: 30 * 1000,          // 30 секунд

        // Системні дані
        apiHealth: 30 * 1000,            // 30 секунд
        validation: 5 * 60 * 1000,       // 5 хвилин
        telegramData: 10 * 60 * 1000,    // 10 хвилин
        tokenInfo: 60 * 1000,            // 1 хвилина

        // UI дані
        uiState: Infinity,               // Не видаляється автоматично
        tempData: 10 * 1000              // 10 секунд
    };

    // Основне сховище
    const storage = {
        data: new Map(),
        metadata: new Map(),
        subscribers: new Map(),
        cleanupTimers: new Map()
    };

    // Статистика використання
    const stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        startTime: Date.now()
    };

    /**
     * Генерація ключа з namespace
     */
    function generateKey(namespace, key) {
        return `${namespace}:${key}`;
    }

    /**
     * Встановити значення в кеш
     */
    function set(namespace, key, value, customTTL) {
        const fullKey = generateKey(namespace, key);
        const ttl = customTTL || TTL_CONFIG[namespace] || 60000;

        // Очищаємо старий таймер якщо є
        const oldTimer = storage.cleanupTimers.get(fullKey);
        if (oldTimer) {
            clearTimeout(oldTimer);
        }

        // Зберігаємо дані
        storage.data.set(fullKey, value);
        storage.metadata.set(fullKey, {
            timestamp: Date.now(),
            ttl: ttl,
            namespace: namespace,
            hits: 0,
            size: estimateSize(value)
        });

        // Встановлюємо автоочищення якщо TTL не вічний
        if (ttl !== Infinity) {
            const timer = setTimeout(() => {
                invalidate(namespace, key);
            }, ttl);
            storage.cleanupTimers.set(fullKey, timer);
        }

        stats.sets++;

        // Сповіщаємо підписників
        notifySubscribers(namespace, key, 'set', value);

        // Перевіряємо розмір кешу
        checkCacheSize();

        return value;
    }

    /**
     * Отримати значення з кешу
     */
    function get(namespace, key, defaultValue = null) {
        const fullKey = generateKey(namespace, key);

        if (!storage.data.has(fullKey)) {
            stats.misses++;
            return defaultValue;
        }

        const metadata = storage.metadata.get(fullKey);
        const now = Date.now();

        // Перевіряємо TTL
        if (metadata.ttl !== Infinity && now - metadata.timestamp > metadata.ttl) {
            invalidate(namespace, key);
            stats.misses++;
            return defaultValue;
        }

        // Оновлюємо статистику
        metadata.hits++;
        stats.hits++;

        const value = storage.data.get(fullKey);

        // Сповіщаємо підписників
        notifySubscribers(namespace, key, 'get', value);

        return value;
    }

    /**
     * Перевірити чи існує ключ і чи валідний
     */
    function has(namespace, key) {
        const fullKey = generateKey(namespace, key);

        if (!storage.data.has(fullKey)) {
            return false;
        }

        const metadata = storage.metadata.get(fullKey);
        const now = Date.now();

        // Перевіряємо TTL
        if (metadata.ttl !== Infinity && now - metadata.timestamp > metadata.ttl) {
            invalidate(namespace, key);
            return false;
        }

        return true;
    }

    /**
     * Оновити значення якщо воно змінилось
     */
    function update(namespace, key, value, customTTL) {
        const fullKey = generateKey(namespace, key);
        const oldValue = storage.data.get(fullKey);

        // Перевіряємо чи змінились дані
        if (oldValue !== undefined && JSON.stringify(oldValue) === JSON.stringify(value)) {
            // Дані не змінились, тільки оновлюємо timestamp
            const metadata = storage.metadata.get(fullKey);
            if (metadata) {
                metadata.timestamp = Date.now();
            }
            return false; // Не було змін
        }

        // Дані змінились, оновлюємо
        set(namespace, key, value, customTTL);
        return true; // Були зміни
    }

    /**
     * Інвалідувати конкретний ключ
     */
    function invalidate(namespace, key) {
        const fullKey = generateKey(namespace, key);

        // Видаляємо дані
        const deleted = storage.data.delete(fullKey);
        storage.metadata.delete(fullKey);

        // Очищаємо таймер
        const timer = storage.cleanupTimers.get(fullKey);
        if (timer) {
            clearTimeout(timer);
            storage.cleanupTimers.delete(fullKey);
        }

        if (deleted) {
            stats.deletes++;
            // Сповіщаємо підписників
            notifySubscribers(namespace, key, 'invalidate', null);
        }

        return deleted;
    }

    /**
     * Інвалідувати всі ключі в namespace
     */
    function invalidateNamespace(namespace) {
        const keysToDelete = [];

        storage.metadata.forEach((meta, fullKey) => {
            if (meta.namespace === namespace) {
                keysToDelete.push(fullKey);
            }
        });

        keysToDelete.forEach(fullKey => {
            storage.data.delete(fullKey);
            storage.metadata.delete(fullKey);

            const timer = storage.cleanupTimers.get(fullKey);
            if (timer) {
                clearTimeout(timer);
                storage.cleanupTimers.delete(fullKey);
            }
        });

        stats.deletes += keysToDelete.length;

        // Сповіщаємо всіх підписників namespace
        const subscribers = storage.subscribers.get(namespace);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback('invalidateNamespace', namespace, null);
                } catch (error) {
                    console.error('❌ [CacheManager] Помилка в підписнику:', error);
                }
            });
        }

        return keysToDelete.length;
    }

    /**
     * Підписатись на зміни в кеші
     */
    function subscribe(namespace, callback) {
        if (!storage.subscribers.has(namespace)) {
            storage.subscribers.set(namespace, new Set());
        }

        storage.subscribers.get(namespace).add(callback);

        // Повертаємо функцію відписки
        return function unsubscribe() {
            const subscribers = storage.subscribers.get(namespace);
            if (subscribers) {
                subscribers.delete(callback);
                if (subscribers.size === 0) {
                    storage.subscribers.delete(namespace);
                }
            }
        };
    }

    /**
     * Сповістити підписників про зміни
     */
    function notifySubscribers(namespace, key, action, value) {
        const subscribers = storage.subscribers.get(namespace);
        if (!subscribers) return;

        subscribers.forEach(callback => {
            // Використовуємо microtask для async сповіщення
            queueMicrotask(() => {
                try {
                    callback(action, key, value);
                } catch (error) {
                    console.error('❌ [CacheManager] Помилка в підписнику:', error);
                }
            });
        });
    }

    /**
     * Оцінка розміру даних
     */
    function estimateSize(data) {
        try {
            return JSON.stringify(data).length;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Перевірка розміру кешу та очищення при необхідності
     */
    function checkCacheSize() {
        const maxSize = 10 * 1024 * 1024; // 10MB
        let totalSize = 0;

        storage.metadata.forEach(meta => {
            totalSize += meta.size;
        });

        if (totalSize > maxSize) {
            console.warn('⚠️ [CacheManager] Перевищено ліміт кешу, очищення старих даних');
            performLRUCleanup();
        }
    }

    /**
     * LRU очищення - видаляємо найменш використовувані
     */
    function performLRUCleanup() {
        const entries = [];

        storage.metadata.forEach((meta, fullKey) => {
            // Пропускаємо вічні дані
            if (meta.ttl === Infinity) return;

            entries.push({
                key: fullKey,
                score: meta.hits / (Date.now() - meta.timestamp),
                meta: meta
            });
        });

        // Сортуємо по score (менший score = менш використовуваний)
        entries.sort((a, b) => a.score - b.score);

        // Видаляємо 20% найменш використовуваних
        const toDelete = Math.floor(entries.length * 0.2);

        for (let i = 0; i < toDelete; i++) {
            const entry = entries[i];
            storage.data.delete(entry.key);
            storage.metadata.delete(entry.key);

            const timer = storage.cleanupTimers.get(entry.key);
            if (timer) {
                clearTimeout(timer);
                storage.cleanupTimers.delete(entry.key);
            }
        }

        console.log(`✅ [CacheManager] Очищено ${toDelete} записів`);
    }

    /**
     * Очистити весь кеш
     */
    function clear() {
        // Очищаємо всі таймери
        storage.cleanupTimers.forEach(timer => clearTimeout(timer));

        // Очищаємо дані
        storage.data.clear();
        storage.metadata.clear();
        storage.cleanupTimers.clear();

        stats.deletes += storage.data.size;

        // Сповіщаємо всіх підписників
        storage.subscribers.forEach((subscribers, namespace) => {
            subscribers.forEach(callback => {
                try {
                    callback('clear', null, null);
                } catch (error) {
                    console.error('❌ [CacheManager] Помилка в підписнику:', error);
                }
            });
        });

        console.log('✅ [CacheManager] Кеш очищено');
    }

    /**
     * Отримати статистику кешу
     */
    function getStats() {
        const now = Date.now();
        const uptime = now - stats.startTime;
        const hitRate = stats.hits / (stats.hits + stats.misses) || 0;

        let totalSize = 0;
        let totalEntries = storage.data.size;

        storage.metadata.forEach(meta => {
            totalSize += meta.size;
        });

        return {
            entries: totalEntries,
            size: totalSize,
            sizeFormatted: (totalSize / 1024).toFixed(2) + ' KB',
            hits: stats.hits,
            misses: stats.misses,
            sets: stats.sets,
            deletes: stats.deletes,
            hitRate: (hitRate * 100).toFixed(2) + '%',
            uptime: Math.floor(uptime / 1000) + ' seconds',
            namespaces: new Set(Array.from(storage.metadata.values()).map(m => m.namespace)).size
        };
    }

    /**
     * Отримати дані для конкретного namespace
     */
    function getNamespaceData(namespace) {
        const result = {};

        storage.data.forEach((value, fullKey) => {
            const meta = storage.metadata.get(fullKey);
            if (meta && meta.namespace === namespace) {
                const key = fullKey.replace(`${namespace}:`, '');
                result[key] = value;
            }
        });

        return result;
    }

    /**
     * Batch операції для оптимізації
     */
    const batch = {
        operations: [],

        set(namespace, key, value, ttl) {
            this.operations.push({ type: 'set', namespace, key, value, ttl });
            return this;
        },

        get(namespace, key) {
            const value = get(namespace, key);
            return value;
        },

        invalidate(namespace, key) {
            this.operations.push({ type: 'invalidate', namespace, key });
            return this;
        },

        execute() {
            const results = [];

            this.operations.forEach(op => {
                if (op.type === 'set') {
                    results.push(set(op.namespace, op.key, op.value, op.ttl));
                } else if (op.type === 'invalidate') {
                    results.push(invalidate(op.namespace, op.key));
                }
            });

            this.operations = [];
            return results;
        }
    };

    console.log('✅ [CacheManager] Централізований кеш готовий до роботи');

    // Публічний API
    return {
        set,
        get,
        has,
        update,
        invalidate,
        invalidateNamespace,
        subscribe,
        clear,
        getStats,
        getNamespaceData,
        batch,

        // Константи для namespace
        NAMESPACES: {
            USER: 'userProfile',
            BALANCE: 'balance',
            TASKS: 'tasks',
            WALLET: 'walletStatus',
            DAILY: 'dailyStatus',
            FLEX: 'flexBalance',
            API: 'apiHealth',
            VALIDATION: 'validation',
            TELEGRAM: 'telegramData',
            TOKEN: 'tokenInfo',
            UI: 'uiState',
            TEMP: 'tempData'
        }
    };
})();

console.log('✅ [CacheManager] Модуль експортовано глобально');