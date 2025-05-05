/**
 * Storage - оптимізований модуль для роботи з локальним сховищем
 * Відповідає за:
 * - Надійне збереження даних з автоматичним резервним копіюванням
 * - Типобезпечне читання та запис даних
 * - Управління терміном життя даних
 * - Обробку помилок сховища
 *
 * @version 2.0.0
 */

window.StorageUtils = (function() {
    // Префікс для ключів
    const PREFIX = 'winix_';

    // Налаштування
    const config = {
        useLocalStorage: true,         // Використовувати localStorage
        useSessionStorage: true,       // Використовувати sessionStorage
        useFallback: true,             // Використовувати резервне сховище в пам'яті
        debug: false,                  // Режим відлагодження
        cacheTimeout: 3600000          // Час життя кешу (1 година)
    };

    // Резервне сховище в пам'яті
    const memoryStorage = new Map();

    // Кеш часових міток доступу
    const accessTimes = new Map();

    /**
     * Збереження даних у сховище
     * @param {string} key - Ключ
     * @param {any} value - Значення
     * @param {Object} options - Додаткові параметри
     * @returns {boolean} Успішність операції
     */
    function setItem(key, value, options = {}) {
        // Формуємо ключ з префіксом
        const prefixedKey = addPrefix(key);

        // Параметри за замовчуванням
        const {
            persist = true,         // Зберігати в localStorage
            expires = null,         // Час життя в мс
            compress = false        // Стиснення даних (не реалізовано)
        } = options;

        try {
            // Підготовка даних для збереження
            const metadata = createMetadata(value, expires);
            const dataToStore = prepareValueForStorage(value);

            // Зберігаємо в localStorage
            if (persist && config.useLocalStorage) {
                try {
                    localStorage.setItem(prefixedKey, dataToStore);
                    localStorage.setItem(`${prefixedKey}_meta`, JSON.stringify(metadata));
                } catch (error) {
                    // При помилці заповнення сховища - очищаємо старі дані
                    if (isQuotaExceededError(error)) {
                        cleanupStorage();

                        // Повторна спроба
                        try {
                            localStorage.setItem(prefixedKey, dataToStore);
                            localStorage.setItem(`${prefixedKey}_meta`, JSON.stringify(metadata));
                        } catch (e) {
                            config.useLocalStorage = false;
                        }
                    } else {
                        config.useLocalStorage = false;
                    }
                }
            }

            // Зберігаємо в sessionStorage
            if (!persist && config.useSessionStorage) {
                try {
                    sessionStorage.setItem(prefixedKey, dataToStore);
                    sessionStorage.setItem(`${prefixedKey}_meta`, JSON.stringify(metadata));
                } catch (error) {
                    config.useSessionStorage = false;
                }
            }

            // Резервне копіювання в пам'ять
            if (config.useFallback) {
                memoryStorage.set(prefixedKey, dataToStore);
                memoryStorage.set(`${prefixedKey}_meta`, metadata);
            }

            // Оновлюємо час доступу
            accessTimes.set(prefixedKey, Date.now());

            return true;
        } catch (error) {
            logError(`Помилка збереження даних для ключа ${key}:`, error);
            return false;
        }
    }

    /**
     * Створення метаданих для значення
     * @param {any} value - Значення
     * @param {number|null} expires - Час життя в мс
     * @returns {Object} Метадані
     */
    function createMetadata(value, expires) {
        return {
            timestamp: Date.now(),
            expires: expires ? Date.now() + expires : null,
            type: getValueType(value)
        };
    }

    /**
     * Підготовка значення для збереження
     * @param {any} value - Значення
     * @returns {string} Рядок для збереження
     */
    function prepareValueForStorage(value) {
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return String(value);
    }

    /**
     * Отримання типу значення
     * @param {any} value - Значення
     * @returns {string} Тип значення
     */
    function getValueType(value) {
        if (value instanceof Date) return 'date';
        if (Array.isArray(value)) return 'array';
        return typeof value;
    }

    /**
     * Перевірка на помилку перевищення квоти сховища
     * @param {Error} error - Об'єкт помилки
     * @returns {boolean} Чи є помилка перевищенням квоти
     */
    function isQuotaExceededError(error) {
        return error.name === 'QuotaExceededError' ||
               error.name === 'NS_ERROR_DOM_QUOTA_REACHED';
    }

    /**
     * Виведення помилки в консоль
     * @param {string} message - Повідомлення
     * @param {Error} error - Об'єкт помилки
     */
    function logError(message, error) {
        console.error(`StorageUtils: ${message}`, error);
    }

    /**
     * Отримання даних зі сховища
     * @param {string} key - Ключ
     * @param {any} defaultValue - Значення за замовчуванням
     * @param {Object} options - Додаткові параметри
     * @returns {any} Збережене значення або значення за замовчуванням
     */
    function getItem(key, defaultValue = null, options = {}) {
        const prefixedKey = addPrefix(key);

        // Параметри за замовчуванням
        const {
            checkExpiry = true,     // Перевіряти термін дії
            persist = true,         // Читати з localStorage
            parse = true            // Парсити значення
        } = options;

        try {
            let storedValue = null;
            let metadata = null;

            // Спочатку перевіряємо localStorage
            if (persist && config.useLocalStorage) {
                try {
                    storedValue = localStorage.getItem(prefixedKey);
                    const metaStr = localStorage.getItem(`${prefixedKey}_meta`);
                    if (metaStr) {
                        metadata = JSON.parse(metaStr);
                    }
                } catch (error) {
                    config.useLocalStorage = false;
                }
            }

            // Потім sessionStorage
            if (storedValue === null && !persist && config.useSessionStorage) {
                try {
                    storedValue = sessionStorage.getItem(prefixedKey);
                    const metaStr = sessionStorage.getItem(`${prefixedKey}_meta`);
                    if (metaStr) {
                        metadata = JSON.parse(metaStr);
                    }
                } catch (error) {
                    config.useSessionStorage = false;
                }
            }

            // Нарешті, резервне сховище
            if (storedValue === null && config.useFallback) {
                storedValue = memoryStorage.get(prefixedKey) || null;
                metadata = memoryStorage.get(`${prefixedKey}_meta`) || null;
            }

            // Якщо значення не знайдено
            if (storedValue === null) {
                return defaultValue;
            }

            // Перевіряємо термін дії
            if (checkExpiry && metadata && metadata.expires && metadata.expires < Date.now()) {
                removeItem(key, { persist });
                return defaultValue;
            }

            // Оновлюємо час доступу
            accessTimes.set(prefixedKey, Date.now());

            // Обробка типу даних
            if (parse && metadata && metadata.type) {
                return parseStoredValue(storedValue, metadata.type);
            }

            // Якщо не потрібно парсити
            if (!parse) {
                return storedValue;
            }

            // Автоматичне визначення типу
            try {
                return JSON.parse(storedValue);
            } catch {
                return storedValue;
            }
        } catch (error) {
            logError(`Помилка отримання даних для ключа ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Парсинг збереженого значення відповідно до типу
     * @param {string} value - Збережене значення
     * @param {string} type - Тип значення
     * @returns {any} Розпарсене значення
     */
    function parseStoredValue(value, type) {
        switch (type) {
            case 'number': return parseFloat(value);
            case 'boolean': return value === 'true';
            case 'object':
            case 'array':
                try {
                    return JSON.parse(value);
                } catch {
                    return null;
                }
            case 'date':
                try {
                    return new Date(JSON.parse(value));
                } catch {
                    return new Date();
                }
            default: return value;
        }
    }

    /**
     * Видалення даних зі сховища
     * @param {string} key - Ключ
     * @param {Object} options - Додаткові параметри
     * @returns {boolean} Успішність операції
     */
    function removeItem(key, options = {}) {
        const prefixedKey = addPrefix(key);
        const { persist = true } = options;

        try {
            let success = false;

            // Видаляємо з localStorage
            if (persist && config.useLocalStorage) {
                try {
                    localStorage.removeItem(prefixedKey);
                    localStorage.removeItem(`${prefixedKey}_meta`);
                    success = true;
                } catch (error) {
                    // Ігноруємо помилки
                }
            }

            // Видаляємо з sessionStorage
            if (!persist && config.useSessionStorage) {
                try {
                    sessionStorage.removeItem(prefixedKey);
                    sessionStorage.removeItem(`${prefixedKey}_meta`);
                    success = true;
                } catch (error) {
                    // Ігноруємо помилки
                }
            }

            // Видаляємо з резервного сховища
            if (config.useFallback) {
                memoryStorage.delete(prefixedKey);
                memoryStorage.delete(`${prefixedKey}_meta`);
                success = true;
            }

            // Видаляємо з кешу доступу
            accessTimes.delete(prefixedKey);

            return success;
        } catch (error) {
            logError(`Помилка видалення даних для ключа ${key}:`, error);
            return false;
        }
    }

    /**
     * Очищення сховища
     * @param {Object} options - Опції очищення
     * @returns {boolean} Успішність операції
     */
    function clear(options = {}) {
        const {
            onlyExpired = false,        // Тільки прострочені
            onlyPrefix = true,          // Тільки з префіксом
            preserveKeys = []           // Ключі для збереження
        } = options;

        try {
            // Очищаємо localStorage
            if (config.useLocalStorage) {
                clearStorage(localStorage, { onlyExpired, onlyPrefix, preserveKeys });
            }

            // Очищаємо sessionStorage
            if (config.useSessionStorage) {
                clearStorage(sessionStorage, { onlyExpired, onlyPrefix, preserveKeys });
            }

            // Очищаємо резервне сховище
            if (config.useFallback) {
                clearMemoryStorage({ onlyExpired, onlyPrefix, preserveKeys });
            }

            return true;
        } catch (error) {
            logError('Помилка очищення сховища:', error);
            return false;
        }
    }

    /**
     * Очищення localStorage або sessionStorage
     * @param {Storage} storage - Сховище
     * @param {Object} options - Опції очищення
     */
    function clearStorage(storage, options) {
        const { onlyExpired, onlyPrefix, preserveKeys } = options;

        try {
            // Для повного очищення
            if (!onlyExpired && !onlyPrefix && !preserveKeys.length) {
                storage.clear();
                return;
            }

            // Збираємо ключі для обробки
            const keys = [];
            for (let i = 0; i < storage.length; i++) {
                keys.push(storage.key(i));
            }

            // Обробляємо кожен ключ
            keys.forEach(key => {
                // Пропускаємо збережені ключі
                if (isKeyPreserved(key, preserveKeys)) {
                    return;
                }

                // Пропускаємо ключі без префіксу, якщо потрібно
                if (onlyPrefix && !key.startsWith(PREFIX)) {
                    return;
                }

                // Для прострочених елементів
                if (onlyExpired) {
                    // Перевіряємо метадані
                    if (key.endsWith('_meta')) {
                        try {
                            const metaStr = storage.getItem(key);
                            if (!metaStr) return;

                            const metadata = JSON.parse(metaStr);
                            if (!metadata.expires || metadata.expires > Date.now()) {
                                return;
                            }

                            // Видаляємо прострочений елемент
                            const baseKey = key.slice(0, -5);
                            storage.removeItem(baseKey);
                            storage.removeItem(key);
                        } catch (e) {
                            // Ігноруємо помилки
                        }
                    }
                } else {
                    // Видаляємо всі відповідні елементи
                    storage.removeItem(key);
                }
            });
        } catch (error) {
            // Ігноруємо помилки
        }
    }

    /**
     * Очищення резервного сховища в пам'яті
     * @param {Object} options - Опції очищення
     */
    function clearMemoryStorage(options) {
        const { onlyExpired, onlyPrefix, preserveKeys } = options;

        // Для повного очищення
        if (!onlyExpired && !onlyPrefix && !preserveKeys.length) {
            memoryStorage.clear();
            return;
        }

        // Копіюємо ключі для безпечної ітерації
        const keys = [...memoryStorage.keys()];

        keys.forEach(key => {
            // Пропускаємо збережені ключі
            if (isKeyPreserved(key, preserveKeys)) {
                return;
            }

            // Пропускаємо ключі без префіксу, якщо потрібно
            if (onlyPrefix && !key.startsWith(PREFIX)) {
                return;
            }

            // Для прострочених елементів
            if (onlyExpired) {
                // Перевіряємо метадані
                if (key.endsWith('_meta')) {
                    const metadata = memoryStorage.get(key);
                    if (!metadata || !metadata.expires || metadata.expires > Date.now()) {
                        return;
                    }

                    // Видаляємо прострочений елемент
                    const baseKey = key.slice(0, -5);
                    memoryStorage.delete(baseKey);
                    memoryStorage.delete(key);
                }
            } else {
                // Видаляємо всі відповідні елементи
                memoryStorage.delete(key);
            }
        });
    }

    /**
     * Перевірка, чи ключ входить до списку збережених
     * @param {string} key - Ключ для перевірки
     * @param {Array} preserveKeys - Список ключів для збереження
     * @returns {boolean} Чи зберігається ключ
     */
    function isKeyPreserved(key, preserveKeys) {
        if (!preserveKeys || preserveKeys.length === 0) {
            return false;
        }

        // Нормалізуємо ключ
        const normalizedKey = key.startsWith(PREFIX) ? key.substring(PREFIX.length) : key;

        // Точний збіг
        if (preserveKeys.includes(normalizedKey)) {
            return true;
        }

        // Для метаданих
        if (normalizedKey.endsWith('_meta')) {
            const baseKey = normalizedKey.slice(0, -5);
            return preserveKeys.includes(baseKey);
        }

        return false;
    }

    /**
     * Очищення старих даних для звільнення місця
     */
    function cleanupStorage() {
        try {
            // Спочатку видаляємо прострочені елементи
            clear({ onlyExpired: true });

            // Якщо це не допомогло, видаляємо рідко використовувані дані
            if (accessTimes.size > 0) {
                // Сортуємо ключі за часом доступу
                const sortedKeys = [...accessTimes.entries()]
                    .sort((a, b) => a[1] - b[1])
                    .map(entry => entry[0]);

                // Видаляємо найстаріші 25% ключів
                const keysToRemove = sortedKeys.slice(0, Math.ceil(sortedKeys.length * 0.25));

                keysToRemove.forEach(key => {
                    // Видаляємо з усіх сховищ
                    if (config.useLocalStorage) {
                        try {
                            localStorage.removeItem(key);
                            localStorage.removeItem(`${key}_meta`);
                        } catch (e) {}
                    }

                    if (config.useSessionStorage) {
                        try {
                            sessionStorage.removeItem(key);
                            sessionStorage.removeItem(`${key}_meta`);
                        } catch (e) {}
                    }

                    memoryStorage.delete(key);
                    memoryStorage.delete(`${key}_meta`);
                    accessTimes.delete(key);
                });
            }
        } catch (error) {
            logError('Помилка очищення сховища:', error);
        }
    }

    /**
     * Додавання префіксу до ключа
     * @param {string} key - Ключ
     * @returns {string} Ключ з префіксом
     */
    function addPrefix(key) {
        if (key.startsWith(PREFIX)) {
            return key;
        }
        return PREFIX + key;
    }

    /**
     * Видалення префіксу з ключа
     * @param {string} key - Ключ з префіксом
     * @returns {string} Ключ без префіксу
     */
    function removePrefix(key) {
        if (key.startsWith(PREFIX)) {
            return key.substring(PREFIX.length);
        }
        return key;
    }

    /**
     * Отримання всіх ключів
     * @param {Object} options - Опції
     * @returns {Array} Список ключів
     */
    function getKeys(options = {}) {
        const {
            withPrefix = false,       // Повертати з префіксом
            onlyExpired = false       // Тільки прострочені
        } = options;

        try {
            const keys = new Set();
            const now = Date.now();

            // Функція для обробки ключів з певного сховища
            function processKeys(storage, isMemoryStorage = false) {
                if (!storage) return;

                // Різні підходи для Map та Storage API
                if (isMemoryStorage) {
                    // Для memoryStorage (Map)
                    storage.forEach((value, key) => {
                        if (key.endsWith('_meta') || !key.startsWith(PREFIX)) {
                            return;
                        }

                        if (onlyExpired) {
                            // Перевіряємо термін дії
                            const metadata = storage.get(`${key}_meta`);
                            if (!metadata || !metadata.expires || metadata.expires > now) {
                                return;
                            }
                        }

                        keys.add(withPrefix ? key : removePrefix(key));
                    });
                } else {
                    // Для localStorage/sessionStorage
                    for (let i = 0; i < storage.length; i++) {
                        const key = storage.key(i);

                        // Пропускаємо ключі метаданих та без префіксу
                        if (key.endsWith('_meta') || !key.startsWith(PREFIX)) {
                            continue;
                        }

                        if (onlyExpired) {
                            // Перевіряємо термін дії
                            try {
                                const metaStr = storage.getItem(`${key}_meta`);
                                if (!metaStr) continue;

                                const metadata = JSON.parse(metaStr);
                                if (!metadata.expires || metadata.expires > now) {
                                    continue;
                                }
                            } catch (e) {
                                continue;
                            }
                        }

                        keys.add(withPrefix ? key : removePrefix(key));
                    }
                }
            }

            // Обробляємо ключі з усіх сховищ
            if (config.useLocalStorage) {
                try {
                    processKeys(localStorage);
                } catch (e) {}
            }

            if (config.useSessionStorage) {
                try {
                    processKeys(sessionStorage);
                } catch (e) {}
            }

            if (config.useFallback) {
                processKeys(memoryStorage, true);
            }

            return Array.from(keys);
        } catch (error) {
            logError('Помилка отримання ключів:', error);
            return [];
        }
    }

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

    /**
     * Оновлення конфігурації
     * @param {Object} newConfig - Нова конфігурація
     */
    function updateConfig(newConfig) {
        Object.assign(config, newConfig);

        // Перевіряємо доступність сховищ
        if (config.useLocalStorage) {
            config.useLocalStorage = isLocalStorageAvailable();
        }

        if (config.useSessionStorage) {
            config.useSessionStorage = isSessionStorageAvailable();
        }

        return {...config};
    }

    // Ініціалізація
    (function init() {
        // Перевіряємо доступність сховищ
        config.useLocalStorage = isLocalStorageAvailable();
        config.useSessionStorage = isSessionStorageAvailable();

        if (!config.useLocalStorage && !config.useSessionStorage) {
            console.warn('StorageUtils: Web Storage недоступний. Використовуємо тільки пам\'ять.');
            config.useFallback = true;
        }
    })();

    // Публічний API
    return {
        setItem,
        getItem,
        removeItem,
        clear,
        getKeys,
        updateConfig,

        // Безпечна копія конфігурації для читання
        getConfig: () => ({...config})
    };
})();