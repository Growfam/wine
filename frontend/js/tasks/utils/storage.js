/**
 * Storage - модуль для роботи з локальним сховищем
 * Відповідає за:
 * - Збереження даних у різних сховищах
 * - Завантаження даних зі сховищ
 * - Синхронізацію даних між сховищами
 * - Обробку помилок при роботі зі сховищами
 */

window.StorageUtils = (function() {
    // Префікс для ключів у сховищах
    const PREFIX = 'winix_';

    // Налаштування сховища
    const config = {
        useLocalStorage: true,
        useSessionStorage: true,
        useFallback: true,
        debug: false,
        cacheTimeout: 3600000 // 1 година
    };

    // Резервне сховище в пам'яті (на випадок проблем з localStorage)
    const memoryStorage = {};

    // Часові мітки для кешованих даних
    const cacheTimes = {};

    /**
     * Збереження даних у сховище
     * @param {string} key - Ключ
     * @param {any} value - Значення
     * @param {Object} options - Додаткові параметри
     * @returns {boolean} Чи успішно збережено
     */
    function setItem(key, value, options = {}) {
        // Додаємо префікс до ключа
        const prefixedKey = addPrefix(key);

        // Визначаємо тип сховища
        const {
            persist = true,
            expires = null,
            compress = false
        } = options;

        try {
            // Підготовка даних для збереження
            let dataToStore;

            // Обробка об'єктів та масивів
            if (typeof value === 'object' && value !== null) {
                dataToStore = JSON.stringify(value);
            } else {
                dataToStore = String(value);
            }

            // Метадані для збереження
            const metadata = {
                timestamp: Date.now(),
                expires: expires ? Date.now() + expires : null,
                type: typeof value
            };

            // Зберігаємо в localStorage, якщо потрібно персистентне сховище
            if (persist && config.useLocalStorage) {
                try {
                    localStorage.setItem(prefixedKey, dataToStore);
                    localStorage.setItem(`${prefixedKey}_meta`, JSON.stringify(metadata));
                } catch (error) {
                    console.warn(`StorageUtils: Помилка збереження в localStorage: ${error.message}`);

                    // Якщо проблема з QUOTA_EXCEEDED, спробуємо очистити старі дані
                    if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                        cleanupStorage();

                        // Спробуємо ще раз
                        try {
                            localStorage.setItem(prefixedKey, dataToStore);
                            localStorage.setItem(`${prefixedKey}_meta`, JSON.stringify(metadata));
                        } catch (e) {
                            // Якщо все ще не вдається, переходимо до fallback
                            config.useLocalStorage = false;
                        }
                    } else {
                        config.useLocalStorage = false;
                    }
                }
            }

            // Зберігаємо в sessionStorage, якщо не потрібно персистентне зберігання
            if (!persist && config.useSessionStorage) {
                try {
                    sessionStorage.setItem(prefixedKey, dataToStore);
                    sessionStorage.setItem(`${prefixedKey}_meta`, JSON.stringify(metadata));
                } catch (error) {
                    console.warn(`StorageUtils: Помилка збереження в sessionStorage: ${error.message}`);
                    config.useSessionStorage = false;
                }
            }

            // Fallback: зберігаємо в пам'яті
            if (config.useFallback || (!config.useLocalStorage && !config.useSessionStorage)) {
                memoryStorage[prefixedKey] = dataToStore;
                memoryStorage[`${prefixedKey}_meta`] = metadata;
            }

            // Оновлюємо час кешування
            cacheTimes[prefixedKey] = Date.now();

            return true;
        } catch (error) {
            console.error(`StorageUtils: Помилка збереження даних для ключа ${key}:`, error);
            return false;
        }
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
        const {
            checkExpiry = true,
            persist = true,
            parse = true
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
                        try {
                            metadata = JSON.parse(metaStr);
                        } catch (e) {
                            metadata = null;
                        }
                    }
                } catch (error) {
                    console.warn(`StorageUtils: Помилка отримання з localStorage: ${error.message}`);
                    config.useLocalStorage = false;
                }
            }

            // Якщо не знайдено, перевіряємо sessionStorage
            if (storedValue === null && !persist && config.useSessionStorage) {
                try {
                    storedValue = sessionStorage.getItem(prefixedKey);
                    const metaStr = sessionStorage.getItem(`${prefixedKey}_meta`);
                    if (metaStr) {
                        try {
                            metadata = JSON.parse(metaStr);
                        } catch (e) {
                            metadata = null;
                        }
                    }
                } catch (error) {
                    console.warn(`StorageUtils: Помилка отримання з sessionStorage: ${error.message}`);
                    config.useSessionStorage = false;
                }
            }

            // Якщо не знайдено, перевіряємо memoryStorage
            if (storedValue === null && config.useFallback) {
                storedValue = memoryStorage[prefixedKey] || null;
                metadata = memoryStorage[`${prefixedKey}_meta`] || null;
            }

            // Якщо значення не знайдено, повертаємо значення за замовчуванням
            if (storedValue === null) {
                return defaultValue;
            }

            // Перевіряємо термін дії, якщо потрібно
            if (checkExpiry && metadata && metadata.expires && metadata.expires < Date.now()) {
                // Значення застаріло, видаляємо його
                removeItem(key, { persist });
                return defaultValue;
            }

            // Обробка типу даних
            if (parse && metadata && metadata.type) {
                try {
                    switch (metadata.type) {
                        case 'number':
                            return parseFloat(storedValue);
                        case 'boolean':
                            return storedValue === 'true';
                        case 'object':
                        case 'array':
                            return JSON.parse(storedValue);
                        default:
                            return storedValue;
                    }
                } catch (e) {
                    console.warn(`StorageUtils: Помилка парсингу даних для ключа ${key}:`, e);
                    return storedValue;
                }
            }

            // Якщо немає метаданих або не потрібно парсити, повертаємо як є
            if (!parse) {
                return storedValue;
            }

            // Спроба автоматично визначити тип даних
            try {
                return JSON.parse(storedValue);
            } catch (error) {
                // Якщо не вдалося розпарсити як JSON, повертаємо як є
                return storedValue;
            }
        } catch (error) {
            console.error(`StorageUtils: Помилка отримання даних для ключа ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Видалення даних зі сховища
     * @param {string} key - Ключ
     * @param {Object} options - Додаткові параметри
     * @returns {boolean} Чи успішно видалено
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
                    console.warn(`StorageUtils: Помилка видалення з localStorage: ${error.message}`);
                }
            }

            // Видаляємо з sessionStorage
            if (!persist && config.useSessionStorage) {
                try {
                    sessionStorage.removeItem(prefixedKey);
                    sessionStorage.removeItem(`${prefixedKey}_meta`);
                    success = true;
                } catch (error) {
                    console.warn(`StorageUtils: Помилка видалення з sessionStorage: ${error.message}`);
                }
            }

            // Видаляємо з memoryStorage
            if (config.useFallback) {
                delete memoryStorage[prefixedKey];
                delete memoryStorage[`${prefixedKey}_meta`];
                success = true;
            }

            // Видаляємо з кешу
            delete cacheTimes[prefixedKey];

            return success;
        } catch (error) {
            console.error(`StorageUtils: Помилка видалення даних для ключа ${key}:`, error);
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
            onlyExpired = false,
            onlyPrefix = true,
            preserveKeys = [] // Ключі, які не треба видаляти
        } = options;

        try {
            // Очищаємо localStorage
            if (config.useLocalStorage) {
                if (onlyExpired) {
                    // Видаляємо тільки прострочені елементи
                    clearExpiredItems(localStorage, { preserveKeys });
                } else if (onlyPrefix) {
                    // Видаляємо тільки елементи з префіксом
                    clearPrefixedItems(localStorage, { preserveKeys });
                } else {
                    // Повне очищення
                    try {
                        localStorage.clear();
                    } catch (error) {
                        console.warn(`StorageUtils: Помилка очищення localStorage: ${error.message}`);
                    }
                }
            }

            // Очищаємо sessionStorage
            if (config.useSessionStorage) {
                if (onlyExpired) {
                    // Видаляємо тільки прострочені елементи
                    clearExpiredItems(sessionStorage, { preserveKeys });
                } else if (onlyPrefix) {
                    // Видаляємо тільки елементи з префіксом
                    clearPrefixedItems(sessionStorage, { preserveKeys });
                } else {
                    // Повне очищення
                    try {
                        sessionStorage.clear();
                    } catch (error) {
                        console.warn(`StorageUtils: Помилка очищення sessionStorage: ${error.message}`);
                    }
                }
            }

            // Очищаємо memoryStorage
            if (config.useFallback) {
                if (onlyExpired) {
                    // Видаляємо тільки прострочені елементи
                    clearExpiredItemsFromMemory({ preserveKeys });
                } else if (onlyPrefix) {
                    // Видаляємо тільки елементи з префіксом
                    for (const key in memoryStorage) {
                        if (key.startsWith(PREFIX) && !isKeyPreserved(key, preserveKeys)) {
                            delete memoryStorage[key];
                        }
                    }
                } else {
                    // Повне очищення
                    for (const key in memoryStorage) {
                        if (!isKeyPreserved(key, preserveKeys)) {
                            delete memoryStorage[key];
                        }
                    }
                }
            }

            // Очищаємо кеш часових міток
            for (const key in cacheTimes) {
                if (!isKeyPreserved(key, preserveKeys)) {
                    delete cacheTimes[key];
                }
            }

            return true;
        } catch (error) {
            console.error('StorageUtils: Помилка очищення сховища:', error);
            return false;
        }
    }

    /**
     * Перевірка, чи ключ входить до списку збережених
     * @param {string} key - Ключ для перевірки
     * @param {Array} preserveKeys - Список ключів для збереження
     * @returns {boolean} Чи збережений ключ
     */
    function isKeyPreserved(key, preserveKeys) {
        // Якщо список порожній, нічого не зберігаємо
        if (!preserveKeys || preserveKeys.length === 0) {
            return false;
        }

        // Перевіряємо, чи є ключ у списку збережених
        const normalizedKey = key.startsWith(PREFIX) ? key.substring(PREFIX.length) : key;

        // Перевіряємо точний збіг
        if (preserveKeys.includes(normalizedKey)) {
            return true;
        }

        // Перевіряємо префікс метаданих
        if (normalizedKey.endsWith('_meta')) {
            const baseKey = normalizedKey.substring(0, normalizedKey.length - 5);
            return preserveKeys.includes(baseKey);
        }

        return false;
    }

    /**
     * Видалення прострочених елементів з localStorage або sessionStorage
     * @param {Storage} storage - Сховище (localStorage або sessionStorage)
     * @param {Object} options - Опції
     */
    function clearExpiredItems(storage, options = {}) {
        const { preserveKeys = [] } = options;

        try {
            // Отримуємо всі ключі
            const keys = [];
            for (let i = 0; i < storage.length; i++) {
                keys.push(storage.key(i));
            }

            // Фільтруємо за метаданими
            keys.forEach(key => {
                // Пропускаємо збережені ключі
                if (isKeyPreserved(key, preserveKeys)) {
                    return;
                }

                // Шукаємо метадані
                if (key.endsWith('_meta')) {
                    try {
                        const metaStr = storage.getItem(key);
                        if (metaStr) {
                            const metadata = JSON.parse(metaStr);

                            // Перевіряємо термін дії
                            if (metadata.expires && metadata.expires < Date.now()) {
                                // Видаляємо прострочений елемент
                                const baseKey = key.substring(0, key.length - 5);
                                storage.removeItem(baseKey);
                                storage.removeItem(key);
                            }
                        }
                    } catch (e) {
                        // Ігноруємо помилки при обробці окремих елементів
                    }
                }
            });
        } catch (error) {
            console.error('StorageUtils: Помилка очищення прострочених елементів:', error);
        }
    }

    /**
     * Видалення прострочених елементів з memoryStorage
     * @param {Object} options - Опції
     */
    function clearExpiredItemsFromMemory(options = {}) {
        const { preserveKeys = [] } = options;

        try {
            const now = Date.now();

            // Перебираємо всі ключі memoryStorage
            for (const key in memoryStorage) {
                // Пропускаємо збережені ключі
                if (isKeyPreserved(key, preserveKeys)) {
                    continue;
                }

                // Шукаємо метадані
                if (key.endsWith('_meta')) {
                    const metadata = memoryStorage[key];

                    // Перевіряємо термін дії
                    if (metadata && metadata.expires && metadata.expires < now) {
                        // Видаляємо прострочений елемент
                        const baseKey = key.substring(0, key.length - 5);
                        delete memoryStorage[baseKey];
                        delete memoryStorage[key];
                    }
                }
            }
        } catch (error) {
            console.error('StorageUtils: Помилка очищення прострочених елементів з memoryStorage:', error);
        }
    }

    /**
     * Видалення елементів з префіксом з localStorage або sessionStorage
     * @param {Storage} storage - Сховище (localStorage або sessionStorage)
     * @param {Object} options - Опції
     */
    function clearPrefixedItems(storage, options = {}) {
        const { preserveKeys = [] } = options;

        try {
            // Отримуємо всі ключі
            const keys = [];
            for (let i = 0; i < storage.length; i++) {
                keys.push(storage.key(i));
            }

            // Видаляємо елементи з префіксом
            keys.forEach(key => {
                if (key.startsWith(PREFIX) && !isKeyPreserved(key, preserveKeys)) {
                    storage.removeItem(key);
                }
            });
        } catch (error) {
            console.error('StorageUtils: Помилка очищення елементів з префіксом:', error);
        }
    }

    /**
     * Очищення старих даних для звільнення місця
     */
    function cleanupStorage() {
        try {
            console.warn('StorageUtils: Спроба очистити сховище від старих даних');

            // Спочатку видаляємо прострочені елементи
            clear({ onlyExpired: true });

            // Якщо це не допомогло, видаляємо кешовані дані
            const keysToPreserve = [
                'telegram_user_id',
                'auth_token',
                'auth_token_expiry',
                'userTokens',
                'userCoins',
                'winix_balance',
                'winix_coins',
                'language'
            ];

            clear({
                onlyPrefix: true,
                preserveKeys: keysToPreserve
            });
        } catch (error) {
            console.error('StorageUtils: Помилка очищення сховища:', error);
        }
    }

    /**
     * Додавання префіксу до ключа
     * @param {string} key - Оригінальний ключ
     * @returns {string} Ключ з префіксом
     */
    function addPrefix(key) {
        // Якщо ключ вже має префікс, повертаємо як є
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
     * Отримання усіх ключів
     * @param {Object} options - Опції
     * @returns {Array} Список ключів
     */
    function getKeys(options = {}) {
        const {
            withPrefix = false,
            onlyExpired = false
        } = options;

        try {
            const keys = new Set();
            const now = Date.now();

            // Отримуємо ключі з localStorage
            if (config.useLocalStorage) {
                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);

                        // Пропускаємо ключі метаданих
                        if (key.endsWith('_meta')) {
                            continue;
                        }

                        // Перевіряємо префікс
                        if (key.startsWith(PREFIX)) {
                            // Перевіряємо термін дії, якщо потрібно
                            if (onlyExpired) {
                                const metaKey = `${key}_meta`;
                                const metaStr = localStorage.getItem(metaKey);

                                if (metaStr) {
                                    try {
                                        const metadata = JSON.parse(metaStr);

                                        // Додаємо ключ, тільки якщо він прострочений
                                        if (metadata.expires && metadata.expires < now) {
                                            keys.add(withPrefix ? key : removePrefix(key));
                                        }
                                    } catch (e) {
                                        // Ігноруємо помилки парсингу метаданих
                                    }
                                }
                            } else {
                                // Додаємо всі ключі
                                keys.add(withPrefix ? key : removePrefix(key));
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`StorageUtils: Помилка отримання ключів з localStorage: ${error.message}`);
                }
            }

            // Отримуємо ключі з sessionStorage
            if (config.useSessionStorage) {
                try {
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);

                        // Пропускаємо ключі метаданих
                        if (key.endsWith('_meta')) {
                            continue;
                        }

                        // Перевіряємо префікс
                        if (key.startsWith(PREFIX)) {
                            // Перевіряємо термін дії, якщо потрібно
                            if (onlyExpired) {
                                const metaKey = `${key}_meta`;
                                const metaStr = sessionStorage.getItem(metaKey);

                                if (metaStr) {
                                    try {
                                        const metadata = JSON.parse(metaStr);

                                        // Додаємо ключ, тільки якщо він прострочений
                                        if (metadata.expires && metadata.expires < now) {
                                            keys.add(withPrefix ? key : removePrefix(key));
                                        }
                                    } catch (e) {
                                        // Ігноруємо помилки парсингу метаданих
                                    }
                                }
                            } else {
                                // Додаємо всі ключі
                                keys.add(withPrefix ? key : removePrefix(key));
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`StorageUtils: Помилка отримання ключів з sessionStorage: ${error.message}`);
                }
            }

            // Отримуємо ключі з memoryStorage
            if (config.useFallback) {
                for (const key in memoryStorage) {
                    // Пропускаємо ключі метаданих
                    if (key.endsWith('_meta')) {
                        continue;
                    }

                    // Перевіряємо префікс
                    if (key.startsWith(PREFIX)) {
                        // Перевіряємо термін дії, якщо потрібно
                        if (onlyExpired) {
                            const metaKey = `${key}_meta`;
                            const metadata = memoryStorage[metaKey];

                            // Додаємо ключ, тільки якщо він прострочений
                            if (metadata && metadata.expires && metadata.expires < now) {
                                keys.add(withPrefix ? key : removePrefix(key));
                            }
                        } else {
                            // Додаємо всі ключі
                            keys.add(withPrefix ? key : removePrefix(key));
                        }
                    }
                }
            }

            return Array.from(keys);
        } catch (error) {
            console.error('StorageUtils: Помилка отримання ключів:', error);
            return [];
        }
    }

    /**
     * Перевірка доступності localStorage
     * @returns {boolean} Чи доступний localStorage
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
     * @returns {boolean} Чи доступний sessionStorage
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

        return config;
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
        config: Object.assign({}, config)
    };
})();