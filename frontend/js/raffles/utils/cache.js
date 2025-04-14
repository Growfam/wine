/**
 * cache.js - Оптимізований модуль кешування для WINIX WebApp
 * - Додано механізми валідації кешу
 * - Оптимізовано використання localStorage
 * - Реалізовано стратегії вичищення застарілих даних
 * - Покращено резервне копіювання в пам'ять
 */

import WinixRaffles from '../globals.js';

// Версія модуля кешування
const CACHE_VERSION = '2.0.0';

// Префікс для ключів кешу
const CACHE_PREFIX = 'winix_cache_';

// Префікс з версією для забезпечення сумісності при оновленнях
const VERSION_PREFIX = CACHE_PREFIX + 'v2_';

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

// Поріг заповнення для запуску очищення (90%)
const CLEANUP_THRESHOLD = 0.9;

// Доля кешу, яка повинна бути звільнена при очищенні (30%)
const CLEANUP_TARGET = 0.3;

// Час життя метаданих кешу (1 година)
const METADATA_TTL = 60 * 60 * 1000;

// Мінімальний інтервал між автоматичними очищеннями (5 хвилин)
const MIN_CLEANUP_INTERVAL = 5 * 60 * 1000;

// Прапорець ініціалізації
let _initialized = false;

// Прапорець доступності localStorage
let _localStorageAvailable = false;

// Прапорець доступності indexedDB
let _indexedDBAvailable = false;

// Резервний кеш для випадку недоступності localStorage
const _memoryCache = new Map();

// Кеш метаданих для оптимізації доступу
const _metadataCache = new Map();

// Статистика кешу
let _cacheStats = {
    hits: 0,
    misses: 0,
    writes: 0,
    errors: 0,
    cleanups: 0,
    lastCleanup: 0,
    cacheSize: 0,
    itemCount: 0
};

// Час наступного запланованого очищення
let _nextScheduledCleanup = 0;

// Прапорець блокування паралельного очищення
let _cleanupLock = false;

// Набір ключів, виключених з автоматичного очищення
const _protectedKeys = new Set();

/**
 * Перевірка доступності localStorage
 * @returns {boolean} Чи доступний localStorage
 */
function _checkLocalStorageAvailability() {
    try {
        const testKey = VERSION_PREFIX + 'test';
        localStorage.setItem(testKey, 'test');
        const result = localStorage.getItem(testKey) === 'test';
        localStorage.removeItem(testKey);
        return result;
    } catch (e) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.warn("Локальне сховище недоступне, перехід у режим пам'яті:", e);
        } else {
            console.warn("Локальне сховище недоступне, перехід у режим пам'яті:", e);
        }
        return false;
    }
}

/**
 * Перевірка доступності indexedDB
 * @returns {Promise<boolean>} Чи доступний indexedDB
 */
async function _checkIndexedDBAvailability() {
    try {
        // Перевіряємо наявність indexedDB
        if (!window.indexedDB) {
            return false;
        }

        // Спробуємо відкрити тестову базу даних
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('winix_test_db', 1);

                request.onerror = () => {
                    resolve(false);
                };

                request.onsuccess = (event) => {
                    const db = event.target.result;
                    db.close();
                    // Видаляємо тестову базу даних
                    indexedDB.deleteDatabase('winix_test_db');
                    resolve(true);
                };
            } catch (e) {
                resolve(false);
            }
        });
    } catch (e) {
        return false;
    }
}

/**
 * Серіалізація значення для збереження
 * @param {any} value - Значення для серіалізації
 * @returns {string} Серіалізоване значення
 * @throws {Error} Помилка серіалізації
 */
function _serialize(value) {
    try {
        return JSON.stringify(value);
    } catch (e) {
        // Для CircularJSON та інших складних об'єктів
        try {
            // Спрощуємо структуру об'єкта
            const simplifiedValue = _simplifyForSerialization(value);
            return JSON.stringify(simplifiedValue);
        } catch (innerError) {
            throw new Error(`Неможливо серіалізувати значення: ${innerError.message}`);
        }
    }
}

/**
 * Спрощення складних об'єктів для серіалізації
 * @param {any} value - Значення для спрощення
 * @returns {any} Спрощене значення
 * @private
 */
function _simplifyForSerialization(value) {
    // Для примітивних типів повертаємо як є
    if (value === null || value === undefined ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean') {
        return value;
    }

    // Для дат повертаємо ISO рядок
    if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
    }

    // Для масивів обробляємо кожен елемент
    if (Array.isArray(value)) {
        return value.map(item => {
            try {
                return _simplifyForSerialization(item);
            } catch (e) {
                return null; // Заміняємо проблемні елементи на null
            }
        });
    }

    // Для об'єктів обробляємо кожну властивість
    if (typeof value === 'object') {
        const result = {};
        // Обмежуємо глибину рекурсії
        const MAX_DEPTH = 3;

        function simplifyObject(obj, depth = 0) {
            if (depth > MAX_DEPTH) {
                return { __simplified: true };
            }

            const result = {};

            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    try {
                        const propValue = obj[key];

                        // Рекурсивно обробляємо вкладені об'єкти
                        if (propValue !== null && typeof propValue === 'object' && !(propValue instanceof Date)) {
                            result[key] = simplifyObject(propValue, depth + 1);
                        } else {
                            result[key] = _simplifyForSerialization(propValue);
                        }
                    } catch (e) {
                        result[key] = null; // Заміняємо проблемні властивості на null
                    }
                }
            }

            return result;
        }

        return simplifyObject(value);
    }

    // Для функцій та інших типів повертаємо рядок
    return String(value);
}

/**
 * Десеріалізація значення
 * @param {string} serialized - Серіалізоване значення
 * @returns {any} Десеріалізоване значення
 * @throws {Error} Помилка десеріалізації
 */
function _deserialize(serialized) {
    if (!serialized) return null;

    try {
        const value = JSON.parse(serialized);

        // Відновлюємо спеціальні типи
        function restoreSpecialTypes(obj) {
            if (!obj || typeof obj !== 'object') return obj;

            // Відновлюємо дати
            if (obj.__type === 'Date' && obj.value) {
                return new Date(obj.value);
            }

            // Рекурсивно обробляємо масиви
            if (Array.isArray(obj)) {
                return obj.map(item => restoreSpecialTypes(item));
            }

            // Рекурсивно обробляємо об'єкти
            if (typeof obj === 'object') {
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        obj[key] = restoreSpecialTypes(obj[key]);
                    }
                }
            }

            return obj;
        }

        return restoreSpecialTypes(value);
    } catch (e) {
        throw new Error(`Неможливо десеріалізувати значення: ${e.message}`);
    }
}

/**
 * Безпечне отримання даних з localStorage
 * @param {string} key - Ключ для отримання
 * @returns {string|null} Отримані дані або null при помилці
 */
function _safeGetItem(key) {
    if (!_localStorageAvailable) {
        return _memoryCache.get(key) || null;
    }

    try {
        return localStorage.getItem(key);
    } catch (e) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.warn(`Cache: Помилка читання з localStorage: ${e.message}`);
        } else {
            console.warn(`Cache: Помилка читання з localStorage: ${e.message}`);
        }
        _localStorageAvailable = false; // Позначаємо, що localStorage недоступний
        return _memoryCache.get(key) || null;
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
    _memoryCache.set(key, value);

    if (!_localStorageAvailable) {
        return false;
    }

    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.warn(`Cache: Помилка запису в localStorage: ${e.message}`);
        } else {
            console.warn(`Cache: Помилка запису в localStorage: ${e.message}`);
        }

        // Якщо помилка пов'язана з переповненням, спробуємо очистити кеш
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            try {
                // Очищаємо старі дані і пробуємо знову
                if (forcedCleanupCache(0.5)) { // Звільняємо 50% кешу
                    try {
                        localStorage.setItem(key, value);
                        return true;
                    } catch (retryError) {
                        // Не вдалося навіть після очищення
                        _localStorageAvailable = false;
                        return false;
                    }
                } else {
                    _localStorageAvailable = false;
                    return false;
                }
            } catch (cleanupError) {
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
    _memoryCache.delete(key);

    // Видаляємо з кешу метаданих, якщо є
    _metadataCache.delete(key);

    if (!_localStorageAvailable) {
        return false;
    }

    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.warn(`Cache: Помилка видалення з localStorage: ${e.message}`);
        } else {
            console.warn(`Cache: Помилка видалення з localStorage: ${e.message}`);
        }
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
        return Array.from(_memoryCache.keys());
    }

    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(VERSION_PREFIX)) {
                keys.push(key);
            }
        }
        return keys;
    } catch (e) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.warn(`Cache: Помилка отримання ключів localStorage: ${e.message}`);
        } else {
            console.warn(`Cache: Помилка отримання ключів localStorage: ${e.message}`);
        }
        _localStorageAvailable = false;
        return Array.from(_memoryCache.keys());
    }
}

/**
 * Отримання розміру даних в localStorage
 * @returns {number} Розмір у байтах
 */
function _getStorageSize() {
    if (!_localStorageAvailable) {
        // Приблизний розмір даних в пам'яті
        let size = 0;
        for (const [key, value] of _memoryCache.entries()) {
            size += (key.length + (value ? value.length : 0)) * 2; // UTF-16 використовує 2 байти на символ
        }
        return size;
    }

    try {
        let size = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            size += (key.length + (value ? value.length : 0)) * 2; // UTF-16 використовує 2 байти на символ
        }
        return size;
    } catch (e) {
        _localStorageAvailable = false;
        return 0;
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
        if (WinixRaffles.logger) {
            WinixRaffles.logger.warn("Cache: Порожній тип або ключ", { type, key });
        } else {
            console.warn("Cache: Порожній тип або ключ", { type, key });
        }
        return VERSION_PREFIX + TYPE_PREFIXES.GLOBAL + (key || "unknown");
    }

    const normalizedType = type.toUpperCase();
    const cacheType = TYPE_PREFIXES[normalizedType] || TYPE_PREFIXES.GLOBAL;
    return VERSION_PREFIX + cacheType + key;
}

/**
 * Збереження метаданих для кешу
 * @private
 */
function _saveMetadata() {
    try {
        if (!_localStorageAvailable) return;

        // Розмір кешу
        const cacheSize = _getStorageSize();

        // Зберігаємо метадані
        const metadata = {
            version: CACHE_VERSION,
            stats: _cacheStats,
            lastUpdated: Date.now()
        };

        // Оновлюємо розмір кешу в статистиці
        _cacheStats.cacheSize = cacheSize;

        // Серіалізуємо метадані
        const serializedMetadata = _serialize(metadata);

        // Зберігаємо в localStorage
        localStorage.setItem(VERSION_PREFIX + 'metadata', serializedMetadata);
    } catch (e) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка збереження метаданих:", e);
        } else {
            console.error("Cache: Помилка збереження метаданих:", e);
        }
    }
}

/**
 * Завантаження метаданих кешу
 * @private
 */
function _loadMetadata() {
    try {
        if (!_localStorageAvailable) return;

        // Отримуємо метадані
        const serializedMetadata = localStorage.getItem(VERSION_PREFIX + 'metadata');
        if (!serializedMetadata) return;

        // Десеріалізуємо метадані
        const metadata = _deserialize(serializedMetadata);
        if (!metadata || metadata.version !== CACHE_VERSION) return;

        // Перевіряємо актуальність метаданих
        if (metadata.lastUpdated && (Date.now() - metadata.lastUpdated < METADATA_TTL)) {
            // Оновлюємо статистику кешу
            _cacheStats = { ..._cacheStats, ...metadata.stats };
        }
    } catch (e) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка завантаження метаданих:", e);
        } else {
            console.error("Cache: Помилка завантаження метаданих:", e);
        }
    }
}

/**
 * Зберігає дані в кеш
 * @param {string} type - Тип кешу (з CACHE_TYPES)
 * @param {string} key - Ключ для кешування
 * @param {any} data - Дані для зберігання
 * @param {number} ttl - Час життя в мілісекундах (необов'язково)
 * @returns {boolean} Успішність операції
 */
export function set(type, key, data, ttl) {
    if (!type || !key) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.warn("Cache: Не вказано тип або ключ", { type, key });
        } else {
            console.warn("Cache: Не вказано тип або ключ", { type, key });
        }
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
            type: normalizedType,
            version: CACHE_VERSION
        };

        // Генеруємо ключ кешу
        const cacheKey = generateCacheKey(normalizedType, key);

        // Серіалізуємо дані, обробляючи можливі помилки
        let serializedData;
        try {
            serializedData = _serialize(cacheObject);
        } catch (jsonError) {
            if (WinixRaffles.logger) {
                WinixRaffles.logger.warn(`Cache: Помилка серіалізації даних для ключа ${key}:`, jsonError);
            } else {
                console.warn(`Cache: Помилка серіалізації даних для ключа ${key}:`, jsonError);
            }
            // Спробуємо спростити дані і серіалізувати знову
            try {
                const simplifiedData = {
                    ...cacheObject,
                    data: typeof data === 'object' ? { simplified: true } : String(data)
                };
                serializedData = _serialize(simplifiedData);
            } catch (simplifyError) {
                if (WinixRaffles.logger) {
                    WinixRaffles.logger.error(`Cache: Критична помилка серіалізації даних для ключа ${key}:`, simplifyError);
                } else {
                    console.error(`Cache: Критична помилка серіалізації даних для ключа ${key}:`, simplifyError);
                }
                _cacheStats.errors++;
                return false;
            }
        }

        // Зберігаємо метадані в кеш
        _metadataCache.set(cacheKey, {
            expiresAt,
            createdAt: Date.now(),
            type: normalizedType,
            size: serializedData.length
        });

        // Зберігаємо дані
        const success = _safeSetItem(cacheKey, serializedData);

        // Оновлюємо статистику
        _cacheStats.writes++;
        _cacheStats.itemCount = _metadataCache.size;

        // Перевіряємо необхідність очищення кешу
        _checkAndScheduleCleanup();

        return success;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка при збереженні даних до кешу:", error);
        } else {
            console.error("Cache: Помилка при збереженні даних до кешу:", error);
        }
        _cacheStats.errors++;
        return false;
    }
}

/**
 * Перевіряє необхідність очищення кешу і планує його
 * @private
 */
function _checkAndScheduleCleanup() {
    try {
        // Отримуємо поточний час
        const now = Date.now();

        // Перевіряємо, чи не заплановано вже очищення
        if (_nextScheduledCleanup > now) {
            return;
        }

        // Отримуємо розмір кешу
        const cacheSize = _getStorageSize();

        // Якщо розмір кешу перевищує поріг, запускаємо очищення
        if (cacheSize > MAX_CACHE_SIZE * CLEANUP_THRESHOLD) {
            // Плануємо очищення
            _nextScheduledCleanup = now + MIN_CLEANUP_INTERVAL;

            // Запускаємо очищення асинхронно
            setTimeout(() => {
                if (!_cleanupLock) {
                    cleanupCache();
                }
            }, 100);
        }
    } catch (e) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка перевірки необхідності очищення кешу:", e);
        } else {
            console.error("Cache: Помилка перевірки необхідності очищення кешу:", e);
        }
    }
}

/**
 * Валідує об'єкт кешу
 * @param {Object} cacheObject - Об'єкт кешу для валідації
 * @returns {boolean} Результат валідації
 * @private
 */
function _validateCacheObject(cacheObject) {
    // Перевіряємо наявність усіх необхідних полів
    if (!cacheObject ||
        !cacheObject.data ||
        !cacheObject.expiresAt ||
        !cacheObject.createdAt ||
        !cacheObject.type) {
        return false;
    }

    // Перевіряємо термін дії
    if (cacheObject.expiresAt < Date.now()) {
        return false;
    }

    // Перевіряємо версію кешу
    if (cacheObject.version !== CACHE_VERSION) {
        return false;
    }

    return true;
}

/**
 * Отримує дані з кешу
 * @param {string} type - Тип кешу (з CACHE_TYPES)
 * @param {string} key - Ключ для пошуку
 * @param {any} defaultValue - Значення за замовчуванням, якщо кеш відсутній
 * @returns {any} Дані з кешу або defaultValue
 */
export function get(type, key, defaultValue = null) {
    if (!type || !key) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.warn("Cache: Не вказано тип або ключ", { type, key });
        } else {
            console.warn("Cache: Не вказано тип або ключ", { type, key });
        }
        _cacheStats.misses++;
        return defaultValue;
    }

    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const normalizedType = (type && type.toUpperCase && CACHE_TYPES[type.toUpperCase()]) ?
            type.toUpperCase() : 'GLOBAL';

        // Отримуємо дані з localStorage
        const cacheKey = generateCacheKey(normalizedType, key);

        // Перевіряємо метадані для швидкої перевірки терміну дії
        const metadata = _metadataCache.get(cacheKey);
        if (metadata && metadata.expiresAt < Date.now()) {
            // Кеш застарів
            _safeRemoveItem(cacheKey);
            _cacheStats.misses++;
            return defaultValue;
        }

        const cachedData = _safeGetItem(cacheKey);

        if (!cachedData) {
            _cacheStats.misses++;
            return defaultValue;
        }

        // Парсимо дані з кешу
        let cacheObject;
        try {
            cacheObject = _deserialize(cachedData);
        } catch (parseError) {
            if (WinixRaffles.logger) {
                WinixRaffles.logger.warn(`Cache: Помилка парсингу даних для ключа ${key}:`, parseError);
            } else {
                console.warn(`Cache: Помилка парсингу даних для ключа ${key}:`, parseError);
            }
            _cacheStats.errors++;
            _safeRemoveItem(cacheKey); // Видаляємо пошкоджені дані
            _cacheStats.misses++;
            return defaultValue;
        }

        // Валідуємо об'єкт кешу
        if (!_validateCacheObject(cacheObject)) {
            // Кеш невалідний
            _safeRemoveItem(cacheKey);
            _cacheStats.misses++;
            return defaultValue;
        }

        // Кеш валідний
        _cacheStats.hits++;

        // Оновлюємо метадані з актуальною інформацією
        _metadataCache.set(cacheKey, {
            expiresAt: cacheObject.expiresAt,
            createdAt: cacheObject.createdAt,
            type: cacheObject.type,
            size: cachedData.length
        });

        return cacheObject.data;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка при отриманні даних з кешу:", error);
        } else {
            console.error("Cache: Помилка при отриманні даних з кешу:", error);
        }
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
export function has(type, key) {
    if (!type || !key) {
        return false;
    }

    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const normalizedType = (type && type.toUpperCase && CACHE_TYPES[type.toUpperCase()]) ?
            type.toUpperCase() : 'GLOBAL';

        // Отримуємо дані з localStorage
        const cacheKey = generateCacheKey(normalizedType, key);

        // Спочатку перевіряємо метадані для швидкої перевірки
        const metadata = _metadataCache.get(cacheKey);
        if (metadata) {
            return metadata.expiresAt >= Date.now();
        }

        const cachedData = _safeGetItem(cacheKey);

        if (!cachedData) {
            return false;
        }

        // Парсимо дані з кешу
        let cacheObject;
        try {
            cacheObject = _deserialize(cachedData);
        } catch (parseError) {
            _safeRemoveItem(cacheKey); // Видаляємо пошкоджені дані
            return false;
        }

        // Валідуємо об'єкт кешу та термін дії
        if (!_validateCacheObject(cacheObject)) {
            _safeRemoveItem(cacheKey);
            return false;
        }

        // Оновлюємо метадані
        _metadataCache.set(cacheKey, {
            expiresAt: cacheObject.expiresAt,
            createdAt: cacheObject.createdAt,
            type: cacheObject.type,
            size: cachedData.length
        });

        return true;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка при перевірці кешу:", error);
        } else {
            console.error("Cache: Помилка при перевірці кешу:", error);
        }
        return false;
    }
}

/**
 * Видаляє дані з кешу
 * @param {string} type - Тип кешу (з CACHE_TYPES)
 * @param {string} key - Ключ для видалення
 * @returns {boolean} Успішність операції
 */
export function remove(type, key) {
    if (!type || !key) {
        return false;
    }

    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const normalizedType = (type && type.toUpperCase && CACHE_TYPES[type.toUpperCase()]) ?
            type.toUpperCase() : 'GLOBAL';

        // Видаляємо дані з localStorage
        const cacheKey = generateCacheKey(normalizedType, key);

        // Видаляємо з кешу метаданих
        _metadataCache.delete(cacheKey);

        // Видаляємо з переліку захищених ключів
        _protectedKeys.delete(cacheKey);

        // Оновлюємо кількість елементів у статистиці
        _cacheStats.itemCount = _metadataCache.size;

        return _safeRemoveItem(cacheKey);
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка при видаленні даних з кешу:", error);
        } else {
            console.error("Cache: Помилка при видаленні даних з кешу:", error);
        }
        return false;
    }
}

/**
 * Захищає ключ кешу від автоматичного очищення
 * @param {string} type - Тип кешу (з CACHE_TYPES)
 * @param {string} key - Ключ для захисту
 * @returns {boolean} Успішність операції
 */
export function protect(type, key) {
    if (!type || !key) {
        return false;
    }

    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const normalizedType = (type && type.toUpperCase && CACHE_TYPES[type.toUpperCase()]) ?
            type.toUpperCase() : 'GLOBAL';

        // Генеруємо ключ кешу
        const cacheKey = generateCacheKey(normalizedType, key);

        // Додаємо до списку захищених ключів
        _protectedKeys.add(cacheKey);

        return true;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка при захисті ключа кешу:", error);
        } else {
            console.error("Cache: Помилка при захисті ключа кешу:", error);
        }
        return false;
    }
}

/**
 * Знімає захист з ключа кешу
 * @param {string} type - Тип кешу (з CACHE_TYPES)
 * @param {string} key - Ключ для зняття захисту
 * @returns {boolean} Успішність операції
 */
export function unprotect(type, key) {
    if (!type || !key) {
        return false;
    }

    try {
        // Якщо тип невалідний, використовуємо GLOBAL
        const normalizedType = (type && type.toUpperCase && CACHE_TYPES[type.toUpperCase()]) ?
            type.toUpperCase() : 'GLOBAL';

        // Генеруємо ключ кешу
        const cacheKey = generateCacheKey(normalizedType, key);

        // Видаляємо з списку захищених ключів
        _protectedKeys.delete(cacheKey);

        return true;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка при знятті захисту з ключа кешу:", error);
        } else {
            console.error("Cache: Помилка при знятті захисту з ключа кешу:", error);
        }
        return false;
    }
}

/**
 * Очищає всі дані кешу певного типу
 * @param {string} type - Тип кешу для очищення (необов'язково)
 * @returns {number} Кількість видалених записів
 */
export function clear(type = null) {
    try {

        // Додаткове очищення заблокованих станів
    if (window._blockApiRequests) window._blockApiRequests = false;
    if (window._activeRequests) window._activeRequests = {};

        let count = 0;
        let prefix = VERSION_PREFIX;

        // Якщо вказано тип, формуємо префікс для цього типу
        if (type && CACHE_TYPES[type.toUpperCase()]) {
            const normalizedType = type.toUpperCase();
            prefix = VERSION_PREFIX + TYPE_PREFIXES[normalizedType];
        }

        // Очищаємо кеш в пам'яті
        if (type) {
            // Очищаємо тільки вказаний тип
            for (const [key, metadata] of _metadataCache.entries()) {
                if (metadata.type === type.toUpperCase()) {
                    _safeRemoveItem(key);
                    _metadataCache.delete(key);
                    count++;
                }
            }
        } else {
            // Очищаємо всі типи
            _metadataCache.clear();

            // Отримуємо всі ключі localStorage та видаляємо відповідні записи
            const keys = _safeGetKeys();
            for (const key of keys) {
                if (key.startsWith(prefix)) {
                    _safeRemoveItem(key);
                    count++;
                }
            }
        }

        // Оновлюємо кількість елементів у статистиці
        _cacheStats.itemCount = _metadataCache.size;

        if (WinixRaffles.logger) {
            WinixRaffles.logger.log(`Cache: Очищено ${count} записів ${type ? `типу ${type}` : 'всіх типів'}`);
        } else {
            console.log(`Cache: Очищено ${count} записів ${type ? `типу ${type}` : 'всіх типів'}`);
        }

        return count;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка при очищенні кешу:", error);
        } else {
            console.error("Cache: Помилка при очищенні кешу:", error);
        }
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
export function updateTTL(type, key, ttl) {
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
            cacheObject = _deserialize(cachedData);
        } catch (parseError) {
            _safeRemoveItem(cacheKey); // Видаляємо пошкоджені дані
            return false;
        }

        // Оновлюємо час життя
        cacheObject.expiresAt = Date.now() + ttl;

        // Зберігаємо оновлений об'єкт
        try {
            const serializedData = _serialize(cacheObject);

            // Оновлюємо метадані
            _metadataCache.set(cacheKey, {
                expiresAt: cacheObject.expiresAt,
                createdAt: cacheObject.createdAt,
                type: cacheObject.type,
                size: serializedData.length
            });

            return _safeSetItem(cacheKey, serializedData);
        } catch (serializeError) {
            if (WinixRaffles.logger) {
                WinixRaffles.logger.error("Cache: Помилка серіалізації при оновленні TTL:", serializeError);
            } else {
                console.error("Cache: Помилка серіалізації при оновленні TTL:", serializeError);
            }
            return false;
        }
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка при оновленні TTL кешу:", error);
        } else {
            console.error("Cache: Помилка при оновленні TTL кешу:", error);
        }
        return false;
    }
}

/**
 * Примусове очищення кешу, видаляє відповідну частину даних
 * @param {number} [fraction=0.3] - Частка кешу, яку потрібно звільнити (0-1)
 * @returns {boolean} Успішність операції
 */
export function forcedCleanupCache(fraction = CLEANUP_TARGET) {
    try {
        // Перевіряємо валідність параметра
        if (fraction <= 0 || fraction > 1) {
            fraction = CLEANUP_TARGET;
        }

        // Поточний розмір кешу
        const currentSize = _getStorageSize();

        // Цільовий розмір для видалення
        const targetRemoveSize = currentSize * fraction;

        // Отримуємо всі ключі кешу
        const keys = _safeGetKeys();

        // Якщо немає ключів, нічого очищати
        if (keys.length === 0) {
            return true;
        }

        // Збираємо інформацію про кеш
        const cacheEntries = [];

        for (const key of keys) {
            // Пропускаємо захищені ключі
            if (_protectedKeys.has(key)) {
                continue;
            }

            // Спробуємо знайти метадані в кеші метаданих
            let metadata = _metadataCache.get(key);

            if (!metadata) {
                // Якщо немає в кеші метаданих, спробуємо прочитати з сховища
                try {
                    const data = _safeGetItem(key);
                    if (!data) continue;

                    const size = data.length;

                    try {
                        const cacheObject = _deserialize(data);
                        if (!cacheObject) continue;

                        metadata = {
                            expiresAt: cacheObject.expiresAt || 0,
                            createdAt: cacheObject.createdAt || 0,
                            type: cacheObject.type || 'UNKNOWN',
                            size: size
                        };

                        // Зберігаємо метадані в кеш
                        _metadataCache.set(key, metadata);
                    } catch (parseError) {
                        // Якщо помилка парсингу, видаляємо ключ
                        _safeRemoveItem(key);
                        continue;
                    }
                } catch (e) {
                    // Якщо помилка читання, пропускаємо ключ
                    continue;
                }
            }

            // Додаємо інформацію про ключ до списку
            cacheEntries.push({
                key: key,
                size: metadata.size,
                expiresAt: metadata.expiresAt || 0,
                createdAt: metadata.createdAt || 0,
                type: metadata.type || 'UNKNOWN'
            });
        }

        // Сортуємо записи: спочатку застарілі, потім найстаріші
        cacheEntries.sort((a, b) => {
            // Спочатку порівнюємо за терміном дії
            const aExpired = a.expiresAt < Date.now();
            const bExpired = b.expiresAt < Date.now();

            if (aExpired && !bExpired) return -1;
            if (!aExpired && bExpired) return 1;

            // Якщо обидва актуальні або обидва застарілі, сортуємо за часом створення
            return a.createdAt - b.createdAt;
        });

        // Видаляємо записи, доки не звільнимо достатньо місця
        let removedSize = 0;
        let removedCount = 0;

        for (const entry of cacheEntries) {
            if (removedSize >= targetRemoveSize) {
                break;
            }

            if (_safeRemoveItem(entry.key)) {
                removedSize += entry.size;
                removedCount++;

                // Видаляємо з кешу метаданих
                _metadataCache.delete(entry.key);
            }
        }

        // Оновлюємо кількість елементів у статистиці
        _cacheStats.itemCount = _metadataCache.size;

        // Оновлюємо статистику
        _cacheStats.cleanups++;
        _cacheStats.lastCleanup = Date.now();

        if (WinixRaffles.logger) {
            WinixRaffles.logger.log(`Cache: Примусово очищено ${removedCount} записів, звільнено ${(removedSize / 1024).toFixed(2)} КБ`);
        } else {
            console.log(`Cache: Примусово очищено ${removedCount} записів, звільнено ${(removedSize / 1024).toFixed(2)} КБ`);
        }

        // Зберігаємо метадані
        _saveMetadata();

        return true;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка при примусовому очищенні кешу:", error);
        } else {
            console.error("Cache: Помилка при примусовому очищенні кешу:", error);
        }
        return false;
    }
}

/**
 * Очищає застарілі дані кешу та оптимізує розмір
 * @returns {number} Кількість видалених записів
 */
export function cleanupCache() {
    // Перевіряємо, чи не виконується вже очищення
    if (_cleanupLock) {
        return 0;
    }

    _cleanupLock = true;

    try {
        const now = Date.now();

        // Не очищуємо кеш частіше ніж раз в MIN_CLEANUP_INTERVAL (окрім примусового виклику)
        if (arguments.length === 0 && now - _cacheStats.lastCleanup < MIN_CLEANUP_INTERVAL) {
            _cleanupLock = false;
            return 0;
        }

        if (WinixRaffles.logger) {
            WinixRaffles.logger.log("Cache: Початок очищення кешу");
        } else {
            console.log("Cache: Початок очищення кешу");
        }

        _cacheStats.lastCleanup = now;

        // Оновлюємо інформацію про метадані
        _updateMetadataFromStorage();

        // Збираємо інформацію про всі кеші
        const cacheEntries = [];
        const keys = _safeGetKeys();

        // Збираємо всі записи, видаляючи пошкоджені
        for (const key of keys) {
            // Пропускаємо захищені ключі
            if (_protectedKeys.has(key)) {
                continue;
            }

            try {
                // Спочатку перевіряємо метадані
                const metadata = _metadataCache.get(key);

                if (metadata) {
                    // Якщо запис застарілий, видаляємо його
                    if (metadata.expiresAt < now) {
                        _safeRemoveItem(key);
                        _metadataCache.delete(key);
                        continue;
                    }

                    // Додаємо інформацію про запис
                    cacheEntries.push({
                        key: key,
                        size: metadata.size,
                        expiresAt: metadata.expiresAt,
                        createdAt: metadata.createdAt,
                        type: metadata.type
                    });

                    // Продовжуємо, оскільки все уже відомо
                    continue;
                }

                // Якщо немає метаданих, читаємо дані
                const data = _safeGetItem(key);
                if (!data) continue;

                let cacheObject;
                try {
                    cacheObject = _deserialize(data);
                } catch (parseError) {
                    // Невалідний формат кешу, видаляємо
                    _safeRemoveItem(key);
                    continue;
                }

                // Якщо запис застарілий, видаляємо його
                if (!cacheObject || !cacheObject.expiresAt || cacheObject.expiresAt < now) {
                    _safeRemoveItem(key);
                    continue;
                }

                // Додаємо інформацію про запис
                cacheEntries.push({
                    key: key,
                    size: data.length,
                    expiresAt: cacheObject.expiresAt || 0,
                    createdAt: cacheObject.createdAt || 0,
                    type: cacheObject.type || 'UNKNOWN'
                });

                // Оновлюємо метадані
                _metadataCache.set(key, {
                    expiresAt: cacheObject.expiresAt,
                    createdAt: cacheObject.createdAt,
                    type: cacheObject.type,
                    size: data.length
                });
            } catch (entryError) {
                // Помилка обробки запису, видаляємо його
                _safeRemoveItem(key);
                _metadataCache.delete(key);
            }
        }

        // Підраховуємо загальний розмір кешу
        let currentSize = cacheEntries.reduce((total, entry) => total + entry.size, 0);
        let removedCount = 0;

        // Якщо розмір кешу перевищує ліміт, видаляємо найстаріші записи
        if (currentSize > MAX_CACHE_SIZE * CLEANUP_THRESHOLD) {
            if (WinixRaffles.logger) {
                WinixRaffles.logger.log(`Cache: Розмір кешу (${(currentSize / 1024).toFixed(2)} КБ) перевищує ліміт (${(MAX_CACHE_SIZE * CLEANUP_THRESHOLD / 1024).toFixed(2)} КБ)`);
            } else {
                console.log(`Cache: Розмір кешу (${(currentSize / 1024).toFixed(2)} КБ) перевищує ліміт (${(MAX_CACHE_SIZE * CLEANUP_THRESHOLD / 1024).toFixed(2)} КБ)`);
            }

            try {
                // Сортуємо за часом створення (спочатку найстаріші)
                cacheEntries.sort((a, b) => a.createdAt - b.createdAt);

                // Видаляємо найстаріші записи, поки розмір не стане прийнятним
                const targetSize = MAX_CACHE_SIZE * (1 - CLEANUP_TARGET);

                while (currentSize > targetSize && cacheEntries.length > 0) {
                    const oldestEntry = cacheEntries.shift();

                    // Пропускаємо захищені ключі
                    if (_protectedKeys.has(oldestEntry.key)) {
                        continue;
                    }

                    if (_safeRemoveItem(oldestEntry.key)) {
                        currentSize -= oldestEntry.size;
                        removedCount++;

                        // Видаляємо з кешу метаданих
                        _metadataCache.delete(oldestEntry.key);
                    }
                }
            } catch (sortError) {
                if (WinixRaffles.logger) {
                    WinixRaffles.logger.error("Cache: Помилка сортування кешу:", sortError);
                } else {
                    console.error("Cache: Помилка сортування кешу:", sortError);
                }

                // Альтернативний спосіб: просто видаляємо перші N записів
                for (let i = 0; i < Math.min(10, cacheEntries.length); i++) {
                    // Пропускаємо захищені ключі
                    if (_protectedKeys.has(cacheEntries[i].key)) {
                        continue;
                    }

                    if (_safeRemoveItem(cacheEntries[i].key)) {
                        removedCount++;

                        // Видаляємо з кешу метаданих
                        _metadataCache.delete(cacheEntries[i].key);
                    }
                }
            }
        }

        // Оновлюємо кількість елементів у статистиці
        _cacheStats.itemCount = _metadataCache.size;

        // Оновлюємо статистику
        _cacheStats.cleanups++;

        // Зберігаємо метадані
        _saveMetadata();

        if (WinixRaffles.logger) {
            WinixRaffles.logger.log(`Cache: Очищення завершено, видалено ${removedCount} записів`);
        } else {
            console.log(`Cache: Очищення завершено, видалено ${removedCount} записів`);
        }

        _cleanupLock = false;
        return removedCount;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка при очищенні кешу:", error);
        } else {
            console.error("Cache: Помилка при очищенні кешу:", error);
        }
        _cleanupLock = false;
        return 0;
    }
}

/**
 * Оновлює метадані з даних сховища
 * @private
 */
function _updateMetadataFromStorage() {
    try {
        // Отримуємо всі ключі
        const keys = _safeGetKeys();

        // Обмежуємо кількість ключів для обробки (не більше 100)
        const keysToProcess = keys.slice(0, 100);

        // Обробляємо тільки ключі, які ще не в кеші метаданих
        for (const key of keysToProcess) {
            if (_metadataCache.has(key)) continue;

            try {
                const data = _safeGetItem(key);
                if (!data) continue;

                try {
                    const cacheObject = _deserialize(data);
                    if (!cacheObject) continue;

                    // Додаємо метадані в кеш
                    _metadataCache.set(key, {
                        expiresAt: cacheObject.expiresAt || 0,
                        createdAt: cacheObject.createdAt || 0,
                        type: cacheObject.type || 'UNKNOWN',
                        size: data.length
                    });
                } catch (parseError) {
                    // Невалідний формат кешу, видаляємо
                    _safeRemoveItem(key);
                }
            } catch (e) {
                // Помилка обробки ключа, пропускаємо
                continue;
            }
        }
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка оновлення метаданих з сховища:", error);
        } else {
            console.error("Cache: Помилка оновлення метаданих з сховища:", error);
        }
    }
}

/**
 * Отримує статистику кешу
 * @returns {Object} Об'єкт зі статистикою кешу
 */
export function getStats() {
    // Оновлюємо розмір кешу
    _cacheStats.cacheSize = _getStorageSize();
    _cacheStats.itemCount = _metadataCache.size;

    // Підготовка даних про використання локального сховища
    const storageStats = {
        total: _getStorageSize(),
        used: _cacheStats.cacheSize,
        items: _cacheStats.itemCount,
        protected: _protectedKeys.size,
        available: _localStorageAvailable,
        maximum: MAX_CACHE_SIZE
    };

    return {
        ..._cacheStats,
        storage: storageStats,
        hitRate: _cacheStats.hits + _cacheStats.misses > 0
            ? (_cacheStats.hits / (_cacheStats.hits + _cacheStats.misses) * 100).toFixed(2)
            : 0,
        version: CACHE_VERSION
    };
}

/**
 * Дефрагментація кешу - переміщення даних з пам'яті в localStorage
 * @returns {number} Кількість перенесених записів
 */
export function defragment() {
    if (!_localStorageAvailable) {
        return 0;
    }

    try {
        let count = 0;

        // Отримуємо всі ключі в пам'яті
        for (const [key, value] of _memoryCache.entries()) {
            // Пропускаємо ключі, які вже є в localStorage
            try {
                const existingValue = localStorage.getItem(key);
                if (existingValue) continue;

                // Переносимо дані в localStorage
                localStorage.setItem(key, value);
                count++;
            } catch (e) {
                // Якщо помилка переповнення, зупиняємо перенесення
                if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    break;
                }
            }
        }

        if (WinixRaffles.logger) {
            WinixRaffles.logger.log(`Cache: Дефрагментація завершена, перенесено ${count} записів`);
        } else {
            console.log(`Cache: Дефрагментація завершена, перенесено ${count} записів`);
        }

        return count;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка при дефрагментації кешу:", error);
        } else {
            console.error("Cache: Помилка при дефрагментації кешу:", error);
        }
        return 0;
    }
}

/**
 * Перенесення даних з localStorage в пам'ять при зниженні заряду батареї
 * @param {number} [threshold=0.15] - Поріг заряду батареї (0-1)
 * @returns {number} Кількість перенесених записів
 */
export function optimizeForLowPower(threshold = 0.15) {
    try {
        // Перевіряємо доступність API батареї
        if (!navigator.getBattery) {
            return 0;
        }

        return navigator.getBattery().then(battery => {
            // Якщо заряд вище порогу, нічого не робимо
            if (battery.level > threshold) {
                return 0;
            }

            // Якщо не на батареї, нічого не робимо
            if (battery.charging) {
                return 0;
            }

            let count = 0;

            // Отримуємо всі ключі localStorage
            const keys = _safeGetKeys();

            // Переносимо дані в пам'ять
            for (const key of keys) {
                try {
                    const value = localStorage.getItem(key);
                    if (!value) continue;

                    // Зберігаємо в пам'яті
                    _memoryCache.set(key, value);
                    count++;
                } catch (e) {
                    continue;
                }
            }

            if (WinixRaffles.logger) {
                WinixRaffles.logger.log(`Cache: Оптимізація для низького заряду завершена, збережено в пам'яті ${count} записів`);
            } else {
                console.log(`Cache: Оптимізація для низького заряду завершена, збережено в пам'яті ${count} записів`);
            }

            return count;
        }).catch(error => {
            if (WinixRaffles.logger) {
                WinixRaffles.logger.error("Cache: Помилка при оптимізації для низького заряду:", error);
            } else {
                console.error("Cache: Помилка при оптимізації для низького заряду:", error);
            }
            return 0;
        });
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка при оптимізації для низького заряду:", error);
        } else {
            console.error("Cache: Помилка при оптимізації для низького заряду:", error);
        }
        return 0;
    }
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
            if (WinixRaffles.logger) {
                WinixRaffles.logger.warn("Cache: localStorage недоступний, використовуємо memory cache");
            } else {
                console.warn("Cache: localStorage недоступний, використовуємо memory cache");
            }
        }

        // Завантажуємо метадані
        _loadMetadata();

        // Очищення застарілих даних при ініціалізації
        setTimeout(() => {
            cleanupCache();
        }, 1000);

        // Перевіряємо доступність indexedDB
        _checkIndexedDBAvailability().then(available => {
            _indexedDBAvailable = available;
        });

        // Встановлюємо флаг ініціалізації
        _initialized = true;

        if (WinixRaffles.logger) {
            WinixRaffles.logger.log("Cache: Система кешування успішно ініціалізована");
        } else {
            console.log("Cache: Система кешування успішно ініціалізована");
        }
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Cache: Помилка ініціалізації системи кешування:", error);
        } else {
            console.error("Cache: Помилка ініціалізації системи кешування:", error);
        }
        // Забезпечуємо, що система все одно працює в режимі memory cache
        _localStorageAvailable = false;
    }
}

// Обробник події низького заряду батареї
if (navigator.getBattery) {
    try {
        navigator.getBattery().then(function(battery) {
            battery.addEventListener('levelchange', function() {
                if (battery.level < 0.15 && !battery.charging) {
                    if (WinixRaffles.logger) {
                        WinixRaffles.logger.log("Cache: Низький рівень заряду, оптимізуємо кеш");
                    } else {
                        console.log("Cache: Низький рівень заряду, оптимізуємо кеш");
                    }
                    optimizeForLowPower();
                }
            });
        }).catch(function(err) {
            if (WinixRaffles.logger) {
                WinixRaffles.logger.warn("Cache: Помилка отримання стану батареї:", err);
            } else {
                console.warn("Cache: Помилка отримання стану батареї:", err);
            }
        });
    } catch (batteryError) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.warn("Cache: Помилка доступу до API батареї:", batteryError);
        } else {
            console.warn("Cache: Помилка доступу до API батареї:", batteryError);
        }
    }
}

// Автоматичне очищення кешу перед вивантаженням сторінки
window.addEventListener('beforeunload', function() {
    try {
        // Тільки якщо багато записів у кеші
        const stats = getStats();
        if (stats.storage.cacheSize > MAX_CACHE_SIZE * 0.5) {
            // Зберігаємо метадані
            _saveMetadata();
        }
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.warn("Cache: Помилка при збереженні метаданих перед вивантаженням:", error);
        } else {
            console.warn("Cache: Помилка при збереженні метаданих перед вивантаженням:", error);
        }
    }
});

// Створюємо об'єкт з усіма функціями кешу
const cacheAPI = {
    set,
    get,
    has,
    remove,
    clear,
    updateTTL,
    cleanupCache,
    forcedCleanupCache,
    getStats,
    protect,
    unprotect,
    defragment,
    optimizeForLowPower,
    types: CACHE_TYPES,
    init,
    version: CACHE_VERSION
};

// Додаємо функції в глобальний об'єкт для зворотної сумісності
if (WinixRaffles && WinixRaffles.utils) {
    WinixRaffles.utils.cache = cacheAPI;
}

// Для повної зворотної сумісності додаємо в window
window.WinixCache = cacheAPI;

// Автоматична ініціалізація
init();

if (WinixRaffles.logger) {
    WinixRaffles.logger.log("Cache: Ініціалізація системи кешування");
} else {
    console.log("Cache: Ініціалізація системи кешування");
}

// Експортуємо об'єкт з усіма функціями як основний експорт
export default cacheAPI;