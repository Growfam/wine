/**
 * Storage - оптимізований модуль для роботи з локальним сховищем
 * Використовує централізований CacheService для зберігання даних
 *
 * Відповідає за:
 * - Надійне збереження даних з автоматичним резервним копіюванням
 * - Типобезпечне читання та запис даних
 * - Управління терміном життя даних
 * - Обробку помилок сховища
 *
 * @version 2.1.0
 */

import cacheService, { STORAGE_TYPES } from './CacheService.js';

// Префікс для ключів
const PREFIX = 'winix_';

// Налаштування за замовчуванням
const defaultConfig = {
    useLocalStorage: true,         // Використовувати localStorage
    useSessionStorage: true,       // Використовувати sessionStorage
    useFallback: true,             // Використовувати резервне сховище в пам'яті
    debug: false,                  // Режим відлагодження
    cacheTimeout: 3600000          // Час життя кешу (1 година)
};

// Поточна конфігурація
let config = { ...defaultConfig };

// Ініціалізуємо CacheService з необхідними параметрами
function initCacheService() {
    // Визначаємо тип сховища на основі конфігурації
    let storageType = STORAGE_TYPES.MEMORY;

    if (config.useLocalStorage) {
        storageType = STORAGE_TYPES.PERSISTENT; // localStorage + пам'ять для резервного копіювання
    } else if (config.useSessionStorage) {
        storageType = STORAGE_TYPES.SESSION;
    }

    // Оновлюємо конфігурацію CacheService
    cacheService.updateConfig({
        storage: storageType,
        prefix: PREFIX,
        defaultTTL: config.cacheTimeout,
        debug: config.debug
    });
}

/**
 * Збереження даних у сховище
 * @param {string} key - Ключ
 * @param {any} value - Значення
 * @param {Object} options - Додаткові параметри
 * @returns {boolean} Успішність операції
 */
export function setItem(key, value, options = {}) {
    // Параметри за замовчуванням
    const {
        persist = true,         // Зберігати в localStorage
        expires = null,         // Час життя в мс
        compress = false        // Стиснення даних (не реалізовано)
    } = options;

    // Використовуємо CacheService для збереження
    return cacheService.set(key, value, {
        ttl: expires || config.cacheTimeout,
        tags: [persist ? 'persistent' : 'session']
    });
}

/**
 * Отримання даних зі сховища
 * @param {string} key - Ключ
 * @param {any} defaultValue - Значення за замовчуванням
 * @param {Object} options - Додаткові параметри
 * @returns {any} Збережене значення або значення за замовчуванням
 */
export function getItem(key, defaultValue = null, options = {}) {
    // Параметри за замовчуванням
    const {
        checkExpiry = true,     // Перевіряти термін дії
        persist = true,         // Читати з localStorage
        parse = true            // Парсити значення
    } = options;

    // Використовуємо CacheService для отримання
    return cacheService.get(key, defaultValue, { checkExpiry });
}

/**
 * Видалення даних зі сховища
 * @param {string} key - Ключ
 * @param {Object} options - Додаткові параметри
 * @returns {boolean} Успішність операції
 */
export function removeItem(key, options = {}) {
    return cacheService.remove(key);
}

/**
 * Очищення сховища
 * @param {Object} options - Опції очищення
 * @returns {boolean} Успішність операції
 */
export function clear(options = {}) {
    const {
        onlyExpired = false,        // Тільки прострочені
        onlyPrefix = true,          // Тільки з префіксом
        preserveKeys = []           // Ключі для збереження
    } = options;

    if (onlyExpired) {
        // Очищаємо тільки прострочені записи
        cacheService.cleanup();
    } else if (preserveKeys && preserveKeys.length > 0) {
        // Отримуємо всі ключі
        const allKeys = cacheService.keys();

        // Фільтруємо ключі, які не треба зберігати
        const keysToRemove = allKeys.filter(key => {
            // Якщо ключ в списку на збереження, пропускаємо
            if (preserveKeys.includes(key)) {
                return false;
            }

            // Якщо тільки з префіксом, перевіряємо префікс
            if (onlyPrefix && !key.startsWith(PREFIX)) {
                return false;
            }

            return true;
        });

        // Видаляємо кожен ключ
        keysToRemove.forEach(key => cacheService.remove(key));
    } else {
        // Для повного очищення
        if (onlyPrefix) {
            // Видаляємо тільки ключі з потрібним префіксом
            cacheService.removeMany(key => key.startsWith(PREFIX));
        } else {
            // Повне очищення
            cacheService.clear();
        }
    }

    return true;
}

/**
 * Отримання всіх ключів
 * @param {Object} options - Опції
 * @returns {Array} Список ключів
 */
export function getKeys(options = {}) {
    const {
        withPrefix = false,       // Повертати з префіксом
        onlyExpired = false       // Тільки прострочені
    } = options;

    // Використовуємо CacheService для отримання ключів
    const keys = cacheService.keys((_key, metadata) => {
        // Якщо тільки прострочені
        if (onlyExpired) {
            return metadata.expiresAt && metadata.expiresAt < Date.now();
        }

        return true;
    });

    // Якщо потрібно повертати з префіксом
    if (withPrefix) {
        return keys;
    }

    // Видаляємо префікс
    return keys.map(key => key.startsWith(PREFIX) ? key.substring(PREFIX.length) : key);
}

/**
 * Оновлення конфігурації
 * @param {Object} newConfig - Нова конфігурація
 */
export function updateConfig(newConfig) {
    // Оновлюємо конфігурацію
    Object.assign(config, newConfig);

    // Переініціалізуємо CacheService з новими параметрами
    initCacheService();

    return {...config};
}

// Початкова ініціалізація
(function init() {
    // Перевіряємо доступність сховищ
    config.useLocalStorage = isLocalStorageAvailable();
    config.useSessionStorage = isSessionStorageAvailable();

    if (!config.useLocalStorage && !config.useSessionStorage) {
        console.warn('StorageUtils: Web Storage недоступний. Використовуємо тільки пам\'ять.');
        config.useFallback = true;
    }

    // Ініціалізуємо CacheService
    initCacheService();
})();

/**
 * Перевірка доступності localStorage
 * @returns {boolean} Доступність localStorage
 */
function isLocalStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Перевірка доступності sessionStorage
 * @returns {boolean} Доступність sessionStorage
 */
function isSessionStorageAvailable() {
    try {
        const test = '__storage_test__';
        sessionStorage.setItem(test, test);
        sessionStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

// Експорт об'єкта за замовчуванням для зворотної сумісності
export default {
    setItem,
    getItem,
    removeItem,
    clear,
    getKeys,
    updateConfig,
    getConfig: () => ({...config})
};