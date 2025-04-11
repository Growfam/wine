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
    USER: 'USER',
    RAFFLE: 'RAFFLE',
    STATS: 'STATS',
    HISTORY: 'HISTORY',
    SYSTEM: 'SYSTEM',
    GLOBAL: 'GLOBAL'
};

// Префікси для типів кешу
const TYPE_PREFIXES = {
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

// Прапорець доступності localStorage
let _localStorageAvailable = false;

// Резервний кеш для випадку недоступності localStorage
const _memoryCache = {};

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
 * Перевірка доступності localStorage
 * @returns {boolean} Чи доступний localStorage
 */
function _checkLocalStorageAvailability() {
    try {
        const testKey = CACHE_PREFIX + 'test';
        localStorage.setItem(testKey, 'test');
        const result = localStorage.getItem(testKey) === 'test';
        localStorage.removeItem(testKey);
        return result;
    } catch (e) {
        return false;
    }
}

/**
 * Безпечне отримання даних з localStorage
 * @param {string} key - Ключ для отримання
 * @returns {string|null} Отримані дані або null при помилці
 */
function _safeGetItem(key) {
    if (!_localStorageAvailable) {
        return _memoryCache[key] || null;
    }

    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.warn(`🔌 Cache: Помилка читання з localStorage: ${e.message}`);
        _localStorageAvailable = false; // Позначаємо, що localStorage недоступний
        return _memoryCache[key] || null;
    }
}

/**
 * Безпечне збереження даних у localStorage
 * @param {string} key - Ключ для збереження
 * @param {string} value - Значення для збереження
 * @returns {boolean} Успішність операції
 */
function _safeSetItem(key, value) {
    // Зберігаємо в memory cache в будь-якому випадку
    _memoryCache[key] = value;

    if (!_localStorageAvailable) {
        return false;
    }

    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.warn(`🔌 Cache: Помилка запису в localStorage: ${e.message}`);

        // Якщо помилка пов'язана з переповненням, спробуємо очистити кеш
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            try {
                // Очищаємо старі дані і пробуємо знову
                cleanupCache();
                localStorage.setItem(key, value);
                return true;
            } catch (retryError) {
                // Не вдалося навіть після очищення
                _localStorageAvailable = false;
                return false;
            }
        }

        _localStorageAvailable = false;
        return false;
    }
}

/**
 * Безпечне видалення даних з localStorage
 * @param {string} key - Ключ для видалення
 * @returns {boolean} Успішність операції
 */
function _safeRemoveItem(key) {
    // Видаляємо з memory cache в будь-якому випадку
    delete _memoryCache[key];

    if (!_localStorageAvailable) {
        return false;
    }

    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.warn(`🔌 Cache: Помилка видалення з localStorage: ${e.message}`);
        _localStorageAvailable = false;
        return false;
    }
}

/**
 * Безпечне отримання всіх ключів localStorage
 * @returns {Array<string>} Масив ключів
 */
function _safeGetKeys() {
    if (!_localStorageAvailable) {
        return Object.keys(_memoryCache);
    }

    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                keys.push(key);
            }
        }
        return keys;
    } catch (e) {
        console.warn(`🔌 Cache: Помилка отримання ключів localStorage: ${e.message}`);
        _localStorageAvailable = false;
        return Object.keys(_memoryCache);
    }
}

/**
 * Генерує ключ кешу на основі типу та ключа
 * @param {string} type - Тип кешу
 * @param {string} key - Ключ для кешування
 * @returns {string} Повний ключ для localStorage
 */
function generateCacheKey(type, key) {
    if (!type || !key) {
        console.warn("🔌 Cache: Порожній тип або ключ", { type, key });
        return CACHE_PREFIX + TYPE_PREFIXES.GLOBAL + (key || "unknown");
    }

    const normalizedType = type.toUpperCase();
    const cacheType = TYPE_PREFIXES[normalizedType] || TYPE_PREFIXES.GLOBAL;
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
    if (!type || !key) {
        console.warn("🔌 Cache: Не вказано тип або ключ", { type, key });
        _cacheStats.errors++;
        return false;
    }

    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const normalizedType = (type && type.toUpperCase && CACHE_TYPES[type.toUpperCase()]) ?
            type.toUpperCase() : 'GLOBAL';

        // Визначаємо TTL (час життя)
        const expiresAt = Date.now() + (ttl || DEFAULT_TTL[normalizedType] || DEFAULT_TTL.GLOBAL);

        // Створюємо об'єкт кешу
        const cacheObject = {
            data: data,
            expiresAt: expiresAt,
            createdAt: Date.now(),
            type: normalizedType
        };

        // Зберігаємо в localStorage
        const cacheKey = generateCacheKey(normalizedType, key);

        // Серіалізуємо дані, обробляючи можливі помилки
        let serializedData;
        try {
            serializedData = JSON.stringify(cacheObject);
        } catch (jsonError) {
            console.warn(`🔌 Cache: Помилка серіалізації даних для ключа ${key}:`, jsonError);
            // Спробуємо спростити дані і серіалізувати знову
            try {
                const simplifiedData = {
                    ...cacheObject,
                    data: typeof data === 'object' ? { simplified: true } : String(data)
                };
                serializedData = JSON.stringify(simplifiedData);
            } catch (simplifyError) {
                console.error(`🔌 Cache: Критична помилка серіалізації даних для ключа ${key}:`, simplifyError);
                _cacheStats.errors++;
                return false;
            }
        }

        // Зберігаємо дані
        const success = _safeSetItem(cacheKey, serializedData);

        // Оновлюємо статистику
        _cacheStats.writes++;

        // Перевіряємо розмір кешу та очищаємо старі записи при необхідності
        if (_cacheStats.writes % 10 === 0) {
            setTimeout(cleanupCache, 0);
        }

        return success;
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
    if (!type || !key) {
        console.warn("🔌 Cache: Не вказано тип або ключ", { type, key });
        _cacheStats.misses++;
        return defaultValue;
    }

    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const normalizedType = (type && type.toUpperCase && CACHE_TYPES[type.toUpperCase()]) ?
            type.toUpperCase() : 'GLOBAL';

        // Отримуємо дані з localStorage
        const cacheKey = generateCacheKey(normalizedType, key);
        const cachedData = _safeGetItem(cacheKey);

        if (!cachedData) {
            _cacheStats.misses++;
            return defaultValue;
        }

        // Парсимо дані з кешу
        let cacheObject;
        try {
            cacheObject = JSON.parse(cachedData);
        } catch (parseError) {
            console.warn(`🔌 Cache: Помилка парсингу даних для ключа ${key}:`, parseError);
            _cacheStats.errors++;
            _safeRemoveItem(cacheKey); // Видаляємо пошкоджені дані
            _cacheStats.misses++;
            return defaultValue;
        }

        // Перевіряємо термін дії
        if (!cacheObject || !cacheObject.expiresAt || cacheObject.expiresAt < Date.now()) {
            // Кеш застарів
            _safeRemoveItem(cacheKey);
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
    if (!type || !key) {
        return false;
    }

    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const normalizedType = (type && type.toUpperCase && CACHE_TYPES[type.toUpperCase()]) ?
            type.toUpperCase() : 'GLOBAL';

        // Отримуємо дані з localStorage
        const cacheKey = generateCacheKey(normalizedType, key);
        const cachedData = _safeGetItem(cacheKey);

        if (!cachedData) {
            return false;
        }

        // Парсимо дані з кешу
        let cacheObject;
        try {
            cacheObject = JSON.parse(cachedData);
        } catch (parseError) {
            _safeRemoveItem(cacheKey); // Видаляємо пошкоджені дані
            return false;
        }

        // Перевіряємо термін дії
        if (!cacheObject || !cacheObject.expiresAt) {
            return false;
        }

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
    if (!type || !key) {
        return false;
    }

    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const normalizedType = (type && type.toUpperCase && CACHE_TYPES[type.toUpperCase()]) ?
            type.toUpperCase() : 'GLOBAL';

        // Видаляємо дані з localStorage
        const cacheKey = generateCacheKey(normalizedType, key);
        return _safeRemoveItem(cacheKey);
    } catch (error) {
        console.error("❌ Cache: Помилка при видаленні даних з кешу:", error);
        return false;
    }
}

/**
 * Очищає всі дані кешу певного типу
 * @param {string} type - Тип кешу для очищення (необов'язково)
 * @returns {number} Кількість видалених записів
 */
export function clearCacheByType(type = null) {
    try {
        let count = 0;
        const keys = _safeGetKeys();

        if (type && CACHE_TYPES[type.toUpperCase()]) {
            // Видаляємо дані конкретного типу
            const normalizedType = type.toUpperCase();
            const prefix = CACHE_PREFIX + TYPE_PREFIXES[normalizedType];

            // Збираємо ключі для видалення
            const keysToRemove = keys.filter(key => key && key.startsWith(prefix));

            // Видаляємо зібрані ключі
            keysToRemove.forEach(key => {
                if (_safeRemoveItem(key)) {
                    count++;
                }
            });
        } else {
            // Видаляємо всі дані кешу
            const prefix = CACHE_PREFIX;

            // Збираємо ключі для видалення
            const keysToRemove = keys.filter(key => key && key.startsWith(prefix));

            // Видаляємо зібрані ключі
            keysToRemove.forEach(key => {
                if (_safeRemoveItem(key)) {
                    count++;
                }
            });
        }

        console.log(`🧹 Cache: Очищено ${count} записів ${type ? `типу ${type}` : 'всіх типів'}`);
        return count;
    } catch (error) {
        console.error("❌ Cache: Помилка при очищенні кешу:", error);
        return 0;
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
    if (!type || !key || !ttl || isNaN(ttl) || ttl <= 0) {
        return false;
    }

    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const normalizedType = (type && type.toUpperCase && CACHE_TYPES[type.toUpperCase()]) ?
            type.toUpperCase() : 'GLOBAL';

        // Отримуємо дані з localStorage
        const cacheKey = generateCacheKey(normalizedType, key);
        const cachedData = _safeGetItem(cacheKey);

        if (!cachedData) {
            return false;
        }

        // Парсимо дані з кешу
        let cacheObject;
        try {
            cacheObject = JSON.parse(cachedData);
        } catch (parseError) {
            _safeRemoveItem(cacheKey); // Видаляємо пошкоджені дані
            return false;
        }

        // Оновлюємо час життя
        cacheObject.expiresAt = Date.now() + ttl;

        // Зберігаємо оновлений об'єкт
        return _safeSetItem(cacheKey, JSON.stringify(cacheObject));
    } catch (error) {
        console.error("❌ Cache: Помилка при оновленні TTL кешу:", error);
        return false;
    }
}

/**
 * Очищає застарілі дані кешу та оптимізує розмір
 * @returns {number} Кількість видалених записів
 */
export function cleanupCache() {
    try {
        const now = Date.now();

        // Не очищуємо кеш частіше ніж раз в 5 хвилин (окрім примусового виклику)
        if (arguments.length === 0 && now - _cacheStats.lastCleanup < 5 * 60 * 1000) {
            return 0;
        }

        console.log("🧹 Cache: Початок очищення кешу");
        _cacheStats.lastCleanup = now;

        // Збираємо інформацію про всі кеші
        const cacheEntries = [];
        const keys = _safeGetKeys();

        for (const key of keys) {
            if (key && key.startsWith(CACHE_PREFIX)) {
                try {
                    const data = _safeGetItem(key);
                    if (!data) continue;

                    let cacheObject;
                    try {
                        cacheObject = JSON.parse(data);
                    } catch (parseError) {
                        // Невалідний формат кешу, видаляємо
                        _safeRemoveItem(key);
                        continue;
                    }

                    cacheEntries.push({
                        key: key,
                        size: data.length,
                        expiresAt: cacheObject.expiresAt || 0,
                        createdAt: cacheObject.createdAt || 0,
                        type: cacheObject.type || 'GLOBAL'
                    });
                } catch (entryError) {
                    // Помилка обробки запису, видаляємо його
                    _safeRemoveItem(key);
                }
            }
        }

        // Видаляємо застарілі записи
        let removedCount = 0;
        for (const entry of cacheEntries) {
            if (entry.expiresAt < now) {
                if (_safeRemoveItem(entry.key)) {
                    removedCount++;
                }
            }
        }

        // Якщо розмір кешу перевищує ліміт, видаляємо найстаріші записи
        let currentSize = cacheEntries.reduce((total, entry) => total + entry.size, 0);

        if (currentSize > MAX_CACHE_SIZE) {
            console.log(`📦 Cache: Розмір кешу (${currentSize} байт) перевищує ліміт (${MAX_CACHE_SIZE} байт)`);

            try {
                // Сортуємо за часом створення (спочатку найстаріші)
                cacheEntries.sort((a, b) => a.createdAt - b.createdAt);

                // Видаляємо найстаріші записи, поки розмір не стане прийнятним
                while (currentSize > MAX_CACHE_SIZE * 0.8 && cacheEntries.length > 0) {
                    const oldestEntry = cacheEntries.shift();
                    if (_safeRemoveItem(oldestEntry.key)) {
                        currentSize -= oldestEntry.size;
                        removedCount++;
                    }
                }
            } catch (sortError) {
                console.error("❌ Cache: Помилка сортування кешу:", sortError);

                // Альтернативний спосіб: просто видаляємо перші N записів
                for (let i = 0; i < Math.min(10, cacheEntries.length); i++) {
                    if (_safeRemoveItem(cacheEntries[i].key)) {
                        removedCount++;
                    }
                }
            }
        }

        console.log(`✅ Cache: Очищення завершено, видалено ${removedCount} записів`);
        _cacheStats.cleanups++;

        return removedCount;
    } catch (error) {
        console.error("❌ Cache: Помилка при очищенні кешу:", error);
        return 0;
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
        cacheItems: 0,
        available: _localStorageAvailable
    };

    try {
        // Рахуємо загальне використання localStorage або memory cache
        const keys = _safeGetKeys();

        for (const key of keys) {
            const value = _safeGetItem(key) || '';

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
        // Перевіряємо доступність localStorage
        _localStorageAvailable = _checkLocalStorageAvailability();

        if (!_localStorageAvailable) {
            console.warn("🔌 Cache: localStorage недоступний, використовуємо memory cache");
        }

        // Очищення застарілих даних при ініціалізації
        cleanupCache();

        // Встановлюємо флаг ініціалізації
        _initialized = true;

        console.log("✅ Cache: Система кешування успішно ініціалізована");
    } catch (error) {
        console.error("❌ Cache: Помилка ініціалізації системи кешування:", error);
        // Забезпечуємо, що система все одно працює в режимі memory cache
        _localStorageAvailable = false;
    }
}

// Обробник події низького заряду батареї
if (navigator.getBattery) {
    try {
        navigator.getBattery().then(function(battery) {
            battery.addEventListener('levelchange', function() {
                if (battery.level < 0.15) {
                    console.log("🔋 Cache: Низький рівень заряду, оптимізуємо кеш");
                    cleanupCache();
                }
            });
        }).catch(function(err) {
            console.warn("⚠️ Cache: Помилка отримання стану батареї:", err);
        });
    } catch (batteryError) {
        console.warn("⚠️ Cache: Помилка доступу до API батареї:", batteryError);
    }
}

// Автоматичне очищення кешу перед вивантаженням сторінки
window.addEventListener('beforeunload', function() {
    try {
        // Тільки якщо багато записів у кеші
        const stats = getCacheStats();
        if (stats.storage.cacheItems > 50) {
            cleanupCache();
        }
    } catch (error) {
        console.warn("⚠️ Cache: Помилка при очищенні кешу перед вивантаженням:", error);
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
if (WinixRaffles && WinixRaffles.utils) {
    WinixRaffles.utils.cache = cacheAPI;
}

// Для повної зворотної сумісності додаємо в window
window.WinixCache = cacheAPI;

// Автоматична ініціалізація
init();

console.log("📦 Cache: Ініціалізація системи кешування");

// Експортуємо об'єкт з усіма функціями як основний експорт
export default cacheAPI;