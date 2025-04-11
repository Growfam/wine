/**
 * cache.js - Модуль кешування для WINIX WebApp
 * Надає уніфікований інтерфейс для зберігання та отримання кешованих даних,
 * з підтримкою терміну дії, інвалідації та оновлення кешу.
 */

import WinixRaffles from '../globals.js';

// Префікс для ключів кешу
const CACHE_PREFIX = 'winix_cache_';

// Типи кешу (для різних просторів імен)
export const CACHE_TYPES = {
    USER: 'user_',
    RAFFLE: 'raffle_',
    STATS: 'stats_',
    HISTORY: 'history_',
    SYSTEM: 'system_',
    GLOBAL: 'global_'
};

// Значення TTL за замовчуванням (у мілісекундах)
const DEFAULT_TTL = {
    USER: 5 * 60 * 1000,        // 5 хвилин для даних користувача
    RAFFLE: 2 * 60 * 1000,      // 2 хвилини для даних розіграшів
    STATS: 10 * 60 * 1000,      // 10 хвилин для статистики
    HISTORY: 30 * 60 * 1000,    // 30 хвилин для історії
    SYSTEM: 60 * 60 * 1000,     // 1 година для системних даних
    GLOBAL: 15 * 60 * 1000      // 15 хвилин для глобальних даних
};

// Максимальний розмір кешу (у байтах, приблизно 4MB)
const MAX_CACHE_SIZE = 4 * 1024 * 1024;

// Прапорець ініціалізації
let _initialized = false;

// Статистика кешу
let _cacheStats = {
    hits: 0,
    misses: 0,
    writes: 0,
    errors: 0,
    cleanups: 0,
    lastCleanup: 0
};

/**
 * Генерує ключ кешу на основі типу та ключа
 * @param {string} type - Тип кешу
 * @param {string} key - Ключ для кешування
 * @returns {string} Повний ключ для localStorage
 */
function generateCacheKey(type, key) {
    const cacheType = CACHE_TYPES[type] || CACHE_TYPES.GLOBAL;
    return CACHE_PREFIX + cacheType + key;
}

/**
 * Зберігає дані в кеш
 * @param {string} type - Тип кешу (з CACHE_TYPES)
 * @param {string} key - Ключ для кешування
 * @param {any} data - Дані для зберігання
 * @param {number} ttl - Час життя в мілісекундах (необов'язково)
 * @returns {boolean} Успішність операції
 */
export function setCache(type, key, data, ttl) {
    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const cacheType = CACHE_TYPES[type] ? type : 'GLOBAL';

        // Визначаємо TTL (час життя)
        const expiresAt = Date.now() + (ttl || DEFAULT_TTL[cacheType]);

        // Створюємо об'єкт кешу
        const cacheObject = {
            data: data,
            expiresAt: expiresAt,
            createdAt: Date.now(),
            type: cacheType
        };

        // Зберігаємо в localStorage
        const cacheKey = generateCacheKey(cacheType, key);
        localStorage.setItem(cacheKey, JSON.stringify(cacheObject));

        // Оновлюємо статистику
        _cacheStats.writes++;

        // Перевіряємо розмір кешу та очищаємо старі записи при необхідності
        if (_cacheStats.writes % 10 === 0) {
            setTimeout(cleanupCache, 0);
        }

        return true;
    } catch (error) {
        console.error("❌ Cache: Помилка при збереженні даних до кешу:", error);
        _cacheStats.errors++;
        return false;
    }
}

/**
 * Отримує дані з кешу
 * @param {string} type - Тип кешу (з CACHE_TYPES)
 * @param {string} key - Ключ для пошуку
 * @param {any} defaultValue - Значення за замовчуванням, якщо кеш відсутній
 * @returns {any} Дані з кешу або defaultValue
 */
export function getCache(type, key, defaultValue = null) {
    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const cacheType = CACHE_TYPES[type] ? type : 'GLOBAL';

        // Отримуємо дані з localStorage
        const cacheKey = generateCacheKey(cacheType, key);
        const cachedData = localStorage.getItem(cacheKey);

        if (!cachedData) {
            _cacheStats.misses++;
            return defaultValue;
        }

        // Парсимо дані з кешу
        const cacheObject = JSON.parse(cachedData);

        // Перевіряємо термін дії
        if (cacheObject.expiresAt < Date.now()) {
            // Кеш застарів
            localStorage.removeItem(cacheKey);
            _cacheStats.misses++;
            return defaultValue;
        }

        // Кеш валідний
        _cacheStats.hits++;
        return cacheObject.data;
    } catch (error) {
        console.error("❌ Cache: Помилка при отриманні даних з кешу:", error);
        _cacheStats.errors++;
        return defaultValue;
    }
}

/**
 * Перевіряє наявність та актуальність даних у кеші
 * @param {string} type - Тип кешу (з CACHE_TYPES)
 * @param {string} key - Ключ для перевірки
 * @returns {boolean} Чи є валідний кеш
 */
export function hasValidCache(type, key) {
    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const cacheType = CACHE_TYPES[type] ? type : 'GLOBAL';

        // Отримуємо дані з localStorage
        const cacheKey = generateCacheKey(cacheType, key);
        const cachedData = localStorage.getItem(cacheKey);

        if (!cachedData) {
            return false;
        }

        // Парсимо дані з кешу
        const cacheObject = JSON.parse(cachedData);

        // Перевіряємо термін дії
        return cacheObject.expiresAt >= Date.now();
    } catch (error) {
        console.error("❌ Cache: Помилка при перевірці кешу:", error);
        return false;
    }
}

/**
 * Видаляє дані з кешу
 * @param {string} type - Тип кешу (з CACHE_TYPES)
 * @param {string} key - Ключ для видалення
 * @returns {boolean} Успішність операції
 */
export function removeCache(type, key) {
    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const cacheType = CACHE_TYPES[type] ? type : 'GLOBAL';

        // Видаляємо дані з localStorage
        const cacheKey = generateCacheKey(cacheType, key);
        localStorage.removeItem(cacheKey);

        return true;
    } catch (error) {
        console.error("❌ Cache: Помилка при видаленні даних з кешу:", error);
        return false;
    }
}

/**
 * Очищає всі дані кешу певного типу
 * @param {string} type - Тип кешу для очищення (необов'язково)
 * @returns {boolean} Успішність операції
 */
export function clearCacheByType(type = null) {
    try {
        if (type && CACHE_TYPES[type]) {
            // Видаляємо дані конкретного типу
            const prefix = CACHE_PREFIX + CACHE_TYPES[type];

            // Збираємо ключі для видалення
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keysToRemove.push(key);
                }
            }

            // Видаляємо зібрані ключі
            keysToRemove.forEach(key => localStorage.removeItem(key));

            return true;
        } else {
            // Видаляємо всі дані кешу
            const prefix = CACHE_PREFIX;

            // Збираємо ключі для видалення
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keysToRemove.push(key);
                }
            }

            // Видаляємо зібрані ключі
            keysToRemove.forEach(key => localStorage.removeItem(key));

            return true;
        }
    } catch (error) {
        console.error("❌ Cache: Помилка при очищенні кешу:", error);
        return false;
    }
}

/**
 * Оновлює час життя кешу
 * @param {string} type - Тип кешу (з CACHE_TYPES)
 * @param {string} key - Ключ для оновлення
 * @param {number} ttl - Новий час життя в мілісекундах
 * @returns {boolean} Успішність операції
 */
export function updateCacheTTL(type, key, ttl) {
    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const cacheType = CACHE_TYPES[type] ? type : 'GLOBAL';

        // Отримуємо дані з localStorage
        const cacheKey = generateCacheKey(cacheType, key);
        const cachedData = localStorage.getItem(cacheKey);

        if (!cachedData) {
            return false;
        }

        // Парсимо дані з кешу
        const cacheObject = JSON.parse(cachedData);

        // Оновлюємо час життя
        cacheObject.expiresAt = Date.now() + ttl;

        // Зберігаємо оновлений об'єкт
        localStorage.setItem(cacheKey, JSON.stringify(cacheObject));

        return true;
    } catch (error) {
        console.error("❌ Cache: Помилка при оновленні TTL кешу:", error);
        return false;
    }
}

/**
 * Очищає застарілі дані кешу та оптимізує розмір
 */
export function cleanupCache() {
    try {
        const now = Date.now();

        // Не очищуємо кеш частіше ніж раз в 5 хвилин
        if (now - _cacheStats.lastCleanup < 5 * 60 * 1000) {
            return;
        }

        console.log("🧹 Cache: Початок очищення кешу");
        _cacheStats.lastCleanup = now;

        // Збираємо інформацію про всі кеші
        const cacheEntries = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_PREFIX)) {
                try {
                    const data = localStorage.getItem(key);
                    const cacheObject = JSON.parse(data);

                    cacheEntries.push({
                        key: key,
                        size: data.length,
                        expiresAt: cacheObject.expiresAt,
                        createdAt: cacheObject.createdAt || 0,
                        type: cacheObject.type || 'GLOBAL'
                    });
                } catch (e) {
                    // Невалідний формат кешу, видаляємо
                    localStorage.removeItem(key);
                }
            }
        }

        // Видаляємо застарілі записи
        let removedCount = 0;
        cacheEntries.forEach(entry => {
            if (entry.expiresAt < now) {
                localStorage.removeItem(entry.key);
                removedCount++;
            }
        });

        // Якщо розмір кешу перевищує ліміт, видаляємо найстаріші записи
        let currentSize = cacheEntries.reduce((total, entry) => total + entry.size, 0);

        if (currentSize > MAX_CACHE_SIZE) {
            console.log(`📦 Cache: Розмір кешу (${currentSize} байт) перевищує ліміт (${MAX_CACHE_SIZE} байт)`);

            // Сортуємо за часом створення (спочатку найстаріші)
            cacheEntries.sort((a, b) => a.createdAt - b.createdAt);

            // Видаляємо найстаріші записи, поки розмір не стане прийнятним
            while (currentSize > MAX_CACHE_SIZE * 0.8 && cacheEntries.length > 0) {
                const oldestEntry = cacheEntries.shift();
                localStorage.removeItem(oldestEntry.key);
                currentSize -= oldestEntry.size;
                removedCount++;
            }
        }

        console.log(`✅ Cache: Очищення завершено, видалено ${removedCount} записів`);
        _cacheStats.cleanups++;

    } catch (error) {
        console.error("❌ Cache: Помилка при очищенні кешу:", error);
    }
}

/**
 * Отримує статистику кешу
 * @returns {Object} Об'єкт зі статистикою кешу
 */
export function getCacheStats() {
    // Підготовка даних про використання локального сховища
    const storageStats = {
        total: 0,
        used: 0,
        items: 0,
        cacheItems: 0
    };

    try {
        // Рахуємо загальне використання localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);

            storageStats.total += key.length + value.length;
            storageStats.items++;

            if (key.startsWith(CACHE_PREFIX)) {
                storageStats.used += key.length + value.length;
                storageStats.cacheItems++;
            }
        }
    } catch (e) {
        console.warn("⚠️ Cache: Помилка при підрахунку статистики сховища:", e);
    }

    return {
        ..._cacheStats,
        storage: storageStats,
        hitRate: _cacheStats.hits + _cacheStats.misses > 0
            ? _cacheStats.hits / (_cacheStats.hits + _cacheStats.misses) * 100
            : 0
    };
}

/**
 * Ініціалізує модуль кешування
 */
export function init() {
    if (_initialized) {
        return;
    }

    try {
        // Очищення застарілих даних при ініціалізації
        cleanupCache();

        // Встановлюємо флаг ініціалізації
        _initialized = true;

        console.log("✅ Cache: Система кешування успішно ініціалізована");
    } catch (error) {
        console.error("❌ Cache: Помилка ініціалізації системи кешування:", error);
    }
}

// Обробник події низького заряду батареї
if (navigator.getBattery) {
    navigator.getBattery().then(function(battery) {
        battery.addEventListener('levelchange', function() {
            if (battery.level < 0.15) {
                console.log("🔋 Cache: Низький рівень заряду, оптимізуємо кеш");
                cleanupCache();
            }
        });
    });
}

// Автоматичне очищення кешу перед вивантаженням сторінки
window.addEventListener('beforeunload', function() {
    // Тільки якщо багато записів у кеші
    const stats = getCacheStats();
    if (stats.storage.cacheItems > 50) {
        cleanupCache();
    }
});

// Створюємо об'єкт з усіма функціями кешу
const cacheAPI = {
    set: setCache,
    get: getCache,
    has: hasValidCache,
    remove: removeCache,
    clear: clearCacheByType,
    updateTTL: updateCacheTTL,
    cleanup: cleanupCache,
    getStats: getCacheStats,
    types: CACHE_TYPES,
    init
};

// Додаємо функції в глобальний об'єкт для зворотної сумісності
WinixRaffles.utils.cache = cacheAPI;

// Для повної зворотної сумісності додаємо в window
window.WinixCache = cacheAPI;

// Автоматична ініціалізація
init();

console.log("📦 Cache: Ініціалізація системи кешування");

// Експортуємо об'єкт з усіма функціями як основний експорт
export default cacheAPI;