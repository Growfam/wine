/**
 * StorageUtils - модуль для безпечної роботи з локальним сховищем
 * Відповідає за:
 * - Збереження та шифрування даних у різних сховищах
 * - Завантаження та дешифрування даних зі сховищ
 * - Синхронізацію даних між сховищами
 * - Розширену обробку помилок при роботі зі сховищами
 * - Контроль розміру даних та механізми стиснення
 * - Резервне копіювання та відновлення даних
 */

window.StorageUtils = (function() {
    // Префікс для ключів у сховищах
    const PREFIX = 'winix_';

    // Маркер для шифрованих даних
    const ENCRYPTION_MARKER = '__ENC__:';

    // Налаштування сховища
    const config = {
        useLocalStorage: true,
        useSessionStorage: true,
        useFallback: true,
        debug: false,
        encryption: true,         // Увімкнути шифрування
        compressionThreshold: 10240, // Поріг стиснення (10 КБ)
        maxItemSize: 1024 * 1024, // Максимальний розмір елемента (1 МБ)
        maxStorageSize: 4.5 * 1024 * 1024, // ~4.5 МБ (трохи менше ліміту 5МБ для localStorage)
        cacheTimeout: 3600000,    // 1 година
        backupInterval: 24 * 3600000, // 24 години між резервними копіями
        encryptionSalt: 'Winix2024Salt' // Сіль для шифрування (не використовуйте це значення у продакшн)
    };

    // Резервне сховище в пам'яті (на випадок проблем з localStorage)
    const memoryStorage = {};

    // Часові мітки для кешованих даних
    const cacheTimes = {};

    // Статистика використання сховища
    const storageStats = {
        lastUpdate: Date.now(),
        localStorageSize: 0,
        sessionStorageSize: 0,
        memoryStorageSize: 0,
        encryptedItemsCount: 0,
        compressedItemsCount: 0,
        errorCount: 0,
        lastBackup: 0
    };

    // Список ключів, які потрібно шифрувати
    const SENSITIVE_KEYS = [
        'user_id',
        'telegram_user_id',
        'auth_token',
        'userTokens',
        'userCoins',
        'winix_balance',
        'winix_coins',
        'wallet_address',
        'email',
        'phone',
        'csrf_token',
        'session_id'
    ];

    // Список важливих ключів для резервного копіювання
    const IMPORTANT_KEYS = [
        'user_id',
        'telegram_user_id',
        'winix_balance',
        'winix_coins',
        'winix_task_progress'
    ];

    /**
     * Шифрування рядка
     * @param {string} text - Рядок для шифрування
     * @param {string} salt - Додаткова сіль для шифрування
     * @returns {string} - Зашифрований рядок
     */
    function encryptString(text, salt = '') {
        if (!text) return '';
        try {
            // Перетворюємо на рядок, якщо це не рядок
            const textStr = typeof text !== 'string' ? JSON.stringify(text) : text;

            // Використовуємо простий XOR-шифр з сіллю
            const fullSalt = config.encryptionSalt + salt;
            let result = '';

            for (let i = 0; i < textStr.length; i++) {
                const charCode = textStr.charCodeAt(i);
                const saltChar = fullSalt.charCodeAt(i % fullSalt.length);
                const encryptedChar = charCode ^ saltChar;

                // Використовуємо Base64 для кодування
                result += String.fromCharCode(encryptedChar);
            }

            // Повертаємо Base64-закодований рядок з маркером
            return ENCRYPTION_MARKER + btoa(result);
        } catch (e) {
            console.error('StorageUtils: Помилка шифрування:', e);
            return text; // У випадку помилки повертаємо оригінальний рядок
        }
    }

    /**
     * Дешифрування рядка
     * @param {string} encryptedText - Зашифрований рядок
     * @param {string} salt - Додаткова сіль для дешифрування
     * @returns {string} - Дешифрований рядок
     */
    function decryptString(encryptedText, salt = '') {
        if (!encryptedText || typeof encryptedText !== 'string') return encryptedText;
        if (!encryptedText.startsWith(ENCRYPTION_MARKER)) return encryptedText;

        try {
            // Видаляємо маркер і декодуємо з Base64
            const encodedText = encryptedText.substring(ENCRYPTION_MARKER.length);
            const decoded = atob(encodedText);

            const fullSalt = config.encryptionSalt + salt;
            let result = '';

            // Виконуємо XOR-дешифрування
            for (let i = 0; i < decoded.length; i++) {
                const charCode = decoded.charCodeAt(i);
                const saltChar = fullSalt.charCodeAt(i % fullSalt.length);
                const decryptedChar = charCode ^ saltChar;

                result += String.fromCharCode(decryptedChar);
            }

            return result;
        } catch (e) {
            console.error('StorageUtils: Помилка дешифрування:', e);
            return encryptedText; // У випадку помилки повертаємо закодований рядок
        }
    }

    /**
     * Стиснення рядка
     * @param {string} text - Рядок для стиснення
     * @returns {string} - Стиснений рядок
     */
    function compressString(text) {
        if (!text || typeof text !== 'string') return text;
        if (text.length < config.compressionThreshold) return text;

        try {
            // Перевіряємо доступність LZString
            if (window.LZString && typeof window.LZString.compressToUTF16 === 'function') {
                return '__COMPRESSED__:' + window.LZString.compressToUTF16(text);
            }

            // Запасний варіант - спрощене стиснення на основі RLE
            let compressed = '';
            let count = 1;
            let currentChar = text[0];

            for (let i = 1; i < text.length; i++) {
                if (text[i] === currentChar && count < 255) {
                    count++;
                } else {
                    compressed += (count > 3 ? count.toString() + currentChar : currentChar.repeat(count));
                    currentChar = text[i];
                    count = 1;
                }
            }

            compressed += (count > 3 ? count.toString() + currentChar : currentChar.repeat(count));

            // Повертаємо стиснений рядок, лише якщо він менший за оригінальний
            return compressed.length < text.length ? '__COMPRESSED_RLE__:' + compressed : text;
        } catch (e) {
            console.error('StorageUtils: Помилка стиснення:', e);
            return text; // У випадку помилки повертаємо оригінальний рядок
        }
    }

    /**
     * Розпакування рядка
     * @param {string} compressedText - Стиснений рядок
     * @returns {string} - Розпакований рядок
     */
    function decompressString(compressedText) {
        if (!compressedText || typeof compressedText !== 'string') return compressedText;

        try {
            // Розпакування LZString
            if (compressedText.startsWith('__COMPRESSED__:')) {
                const compressedData = compressedText.substring('__COMPRESSED__:'.length);
                if (window.LZString && typeof window.LZString.decompressFromUTF16 === 'function') {
                    return window.LZString.decompressFromUTF16(compressedData);
                }
                // Якщо LZString недоступний, повертаємо стиснений рядок
                return compressedText;
            }

            // Розпакування RLE
            if (compressedText.startsWith('__COMPRESSED_RLE__:')) {
                const compressedData = compressedText.substring('__COMPRESSED_RLE__:'.length);
                let decompressed = '';
                let i = 0;

                while (i < compressedData.length) {
                    const countStr = [];
                    // Збираємо цифри для кількості повторень
                    while (i < compressedData.length && !isNaN(parseInt(compressedData[i]))) {
                        countStr.push(compressedData[i]);
                        i++;
                    }

                    // Якщо знайдено цифри, повторюємо символ відповідну кількість разів
                    if (countStr.length > 0 && i < compressedData.length) {
                        const count = parseInt(countStr.join(''));
                        const char = compressedData[i];
                        decompressed += char.repeat(count);
                        i++;
                    } else if (i < compressedData.length) {
                        // Звичайний символ
                        decompressed += compressedData[i];
                        i++;
                    }
                }

                return decompressed;
            }

            return compressedText; // Не стиснений рядок
        } catch (e) {
            console.error('StorageUtils: Помилка розпакування:', e);
            return compressedText; // У випадку помилки повертаємо стиснений рядок
        }
    }

    /**
     * Перевірка, чи ключ є чутливим і потребує шифрування
     * @param {string} key - Ключ для перевірки
     * @returns {boolean} - true, якщо ключ потрібно шифрувати
     */
    function isSensitiveKey(key) {
        // Видаляємо префікс для порівняння
        const normalizedKey = key.startsWith(PREFIX) ? key.substring(PREFIX.length) : key;

        // Перевіряємо, чи містить ключ одне з чутливих слів
        return SENSITIVE_KEYS.some(sensitiveKey =>
            normalizedKey === sensitiveKey ||
            normalizedKey.startsWith(sensitiveKey + '_') ||
            normalizedKey.endsWith('_' + sensitiveKey)
        );
    }

    /**
     * Обчислення розміру даних
     * @param {any} data - Дані для обчислення розміру
     * @returns {number} - Розмір даних у байтах
     */
    function getDataSize(data) {
        try {
            if (data === null || data === undefined) {
                return 0;
            }

            if (typeof data === 'string') {
                // Кожен символ у JavaScript займає 2 байти
                return data.length * 2;
            }

            if (typeof data === 'number') {
                // Приблизний розмір для чисел
                return 8;
            }

            if (typeof data === 'boolean') {
                return 4;
            }

            if (typeof data === 'object') {
                // Перетворюємо об'єкт на JSON і обчислюємо розмір
                const json = JSON.stringify(data);
                return json.length * 2;
            }

            return 0;
        } catch (e) {
            console.warn('StorageUtils: Помилка обчислення розміру даних:', e);
            return 0;
        }
    }

    /**
     * Оновлення статистики використання сховища
     */
    function updateStorageStats() {
        try {
            storageStats.lastUpdate = Date.now();
            storageStats.encryptedItemsCount = 0;
            storageStats.compressedItemsCount = 0;

            // Обчислюємо розмір localStorage
            if (config.useLocalStorage) {
                let totalSize = 0;
                let encryptedCount = 0;
                let compressedCount = 0;

                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(PREFIX)) {
                            const value = localStorage.getItem(key);
                            totalSize += getDataSize(key) + getDataSize(value);

                            if (value && value.startsWith(ENCRYPTION_MARKER)) {
                                encryptedCount++;
                            }

                            if (value && (value.startsWith('__COMPRESSED__:') || value.startsWith('__COMPRESSED_RLE__:'))) {
                                compressedCount++;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('StorageUtils: Помилка обчислення розміру localStorage:', e);
                }

                storageStats.localStorageSize = totalSize;
                storageStats.encryptedItemsCount += encryptedCount;
                storageStats.compressedItemsCount += compressedCount;
            }

            // Обчислюємо розмір sessionStorage
            if (config.useSessionStorage) {
                let totalSize = 0;
                let encryptedCount = 0;
                let compressedCount = 0;

                try {
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        if (key && key.startsWith(PREFIX)) {
                            const value = sessionStorage.getItem(key);
                            totalSize += getDataSize(key) + getDataSize(value);

                            if (value && value.startsWith(ENCRYPTION_MARKER)) {
                                encryptedCount++;
                            }

                            if (value && (value.startsWith('__COMPRESSED__:') || value.startsWith('__COMPRESSED_RLE__:'))) {
                                compressedCount++;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('StorageUtils: Помилка обчислення розміру sessionStorage:', e);
                }

                storageStats.sessionStorageSize = totalSize;
                storageStats.encryptedItemsCount += encryptedCount;
                storageStats.compressedItemsCount += compressedCount;
            }

            // Обчислюємо розмір memoryStorage
            let memorySize = 0;
            let encryptedCount = 0;
            let compressedCount = 0;

            for (const key in memoryStorage) {
                if (Object.prototype.hasOwnProperty.call(memoryStorage, key) && key.startsWith(PREFIX)) {
                    const value = memoryStorage[key];
                    memorySize += getDataSize(key) + getDataSize(value);

                    if (typeof value === 'string' && value.startsWith(ENCRYPTION_MARKER)) {
                        encryptedCount++;
                    }

                    if (typeof value === 'string' && (value.startsWith('__COMPRESSED__:') || value.startsWith('__COMPRESSED_RLE__:'))) {
                        compressedCount++;
                    }
                }
            }

            storageStats.memoryStorageSize = memorySize;
            storageStats.encryptedItemsCount += encryptedCount;
            storageStats.compressedItemsCount += compressedCount;

            // Якщо увімкнено налагодження, виводимо статистику
            if (config.debug) {
                console.debug('StorageUtils: Статистика використання сховища:', {
                    localStorageSize: formatSize(storageStats.localStorageSize),
                    sessionStorageSize: formatSize(storageStats.sessionStorageSize),
                    memoryStorageSize: formatSize(storageStats.memoryStorageSize),
                    encryptedItems: storageStats.encryptedItemsCount,
                    compressedItems: storageStats.compressedItemsCount,
                    errors: storageStats.errorCount
                });
            }
        } catch (e) {
            console.error('StorageUtils: Помилка оновлення статистики сховища:', e);
        }
    }

    /**
     * Форматування розміру в читабельний вигляд
     * @param {number} bytes - Розмір у байтах
     * @returns {string} - Відформатований розмір
     */
    function formatSize(bytes) {
        if (bytes < 1024) {
            return bytes + ' байт';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(2) + ' КБ';
        } else {
            return (bytes / (1024 * 1024)).toFixed(2) + ' МБ';
        }
    }

    /**
     * Створення резервної копії важливих даних
     */
    function createBackup() {
        try {
            // Перевіряємо, чи пройшов достатній час з моменту останнього резервного копіювання
            const now = Date.now();
            if (now - storageStats.lastBackup < config.backupInterval) {
                return;
            }

            // Оновлюємо час останнього резервного копіювання
            storageStats.lastBackup = now;

            // Збираємо важливі дані для резервного копіювання
            const backupData = {};
            let backupSize = 0;

            // Префіксовані ключі для пошуку
            const prefixedImportantKeys = IMPORTANT_KEYS.map(key => addPrefix(key));

            // Функція для додавання даних з певного сховища
            const addDataFromStorage = (storage, storageType) => {
                try {
                    // Для localStorage і sessionStorage
                    if (storage.length) {
                        for (let i = 0; i < storage.length; i++) {
                            const key = storage.key(i);

                            // Шукаємо важливі ключі
                            if (prefixedImportantKeys.includes(key) ||
                                prefixedImportantKeys.some(prefix => key.startsWith(prefix + '_'))) {
                                const rawValue = storage.getItem(key);

                                // Дешифруємо значення, якщо воно зашифроване
                                let value = rawValue;
                                if (typeof rawValue === 'string' && rawValue.startsWith(ENCRYPTION_MARKER)) {
                                    value = decryptString(rawValue);
                                }

                                // Розпаковуємо значення, якщо воно стиснуте
                                if (typeof value === 'string' && (value.startsWith('__COMPRESSED__:') || value.startsWith('__COMPRESSED_RLE__:'))) {
                                    value = decompressString(value);
                                }

                                // Додаємо до резервної копії
                                backupData[key] = {
                                    value: value,
                                    timestamp: Date.now(),
                                    source: storageType
                                };

                                backupSize += getDataSize(key) + getDataSize(value);
                            }
                        }
                    }
                } catch (e) {
                    console.error(`StorageUtils: Помилка при резервному копіюванні з ${storageType}:`, e);
                }
            };

            // Додаємо дані з localStorage
            if (config.useLocalStorage) {
                addDataFromStorage(localStorage, 'localStorage');
            }

            // Додаємо дані з sessionStorage
            if (config.useSessionStorage) {
                addDataFromStorage(sessionStorage, 'sessionStorage');
            }

            // Додаємо дані з memoryStorage
            for (const key in memoryStorage) {
                if (Object.prototype.hasOwnProperty.call(memoryStorage, key) &&
                    (prefixedImportantKeys.includes(key) ||
                    prefixedImportantKeys.some(prefix => key.startsWith(prefix + '_')))) {

                    let value = memoryStorage[key];

                    // Дешифруємо значення, якщо воно зашифроване
                    if (typeof value === 'string' && value.startsWith(ENCRYPTION_MARKER)) {
                        value = decryptString(value);
                    }

                    // Розпаковуємо значення, якщо воно стиснуте
                    if (typeof value === 'string' && (value.startsWith('__COMPRESSED__:') || value.startsWith('__COMPRESSED_RLE__:'))) {
                        value = decompressString(value);
                    }

                    // Додаємо до резервної копії
                    backupData[key] = {
                        value: value,
                        timestamp: Date.now(),
                        source: 'memoryStorage'
                    };

                    backupSize += getDataSize(key) + getDataSize(value);
                }
            }

            // Зберігаємо резервну копію
            const backupKey = `${PREFIX}backup_${now}`;

            // Шифруємо резервну копію
            const backupStr = JSON.stringify(backupData);
            const encryptedBackup = config.encryption ? encryptString(backupStr) : backupStr;

            // Стискаємо, якщо розмір перевищує поріг
            const compressedBackup = backupSize > config.compressionThreshold ? compressString(encryptedBackup) : encryptedBackup;

            // Зберігаємо в localStorage
            if (config.useLocalStorage) {
                try {
                    localStorage.setItem(backupKey, compressedBackup);

                    // Зберігаємо метадані резервної копії
                    localStorage.setItem(`${backupKey}_meta`, JSON.stringify({
                        timestamp: now,
                        size: backupSize,
                        keys: Object.keys(backupData).length,
                        compressed: compressedBackup !== encryptedBackup,
                        encrypted: config.encryption
                    }));

                    if (config.debug) {
                        console.debug(`StorageUtils: Створено резервну копію (${formatSize(backupSize)}, ${Object.keys(backupData).length} ключів)`);
                    }
                } catch (e) {
                    console.error('StorageUtils: Помилка збереження резервної копії в localStorage:', e);

                    // Якщо не вдалося зберегти в localStorage, спробуємо в memoryStorage
                    memoryStorage[backupKey] = compressedBackup;
                    memoryStorage[`${backupKey}_meta`] = {
                        timestamp: now,
                        size: backupSize,
                        keys: Object.keys(backupData).length,
                        compressed: compressedBackup !== encryptedBackup,
                        encrypted: config.encryption
                    };

                    if (config.debug) {
                        console.debug(`StorageUtils: Створено резервну копію в memoryStorage (${formatSize(backupSize)}, ${Object.keys(backupData).length} ключів)`);
                    }
                }
            } else {
                // Зберігаємо в memoryStorage, якщо localStorage недоступний
                memoryStorage[backupKey] = compressedBackup;
                memoryStorage[`${backupKey}_meta`] = {
                    timestamp: now,
                    size: backupSize,
                    keys: Object.keys(backupData).length,
                    compressed: compressedBackup !== encryptedBackup,
                    encrypted: config.encryption
                };

                if (config.debug) {
                    console.debug(`StorageUtils: Створено резервну копію в memoryStorage (${formatSize(backupSize)}, ${Object.keys(backupData).length} ключів)`);
                }
            }

            // Видаляємо старі резервні копії (залишаємо лише 3 останні)
            cleanupOldBackups();
        } catch (e) {
            console.error('StorageUtils: Помилка при створенні резервної копії:', e);
        }
    }

    /**
     * Видалення старих резервних копій
     */
    function cleanupOldBackups() {
        try {
            // Знаходимо всі ключі резервних копій
            const backupKeys = [];

            // Пошук в localStorage
            if (config.useLocalStorage) {
                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(`${PREFIX}backup_`) && !key.endsWith('_meta')) {
                            backupKeys.push({
                                key: key,
                                timestamp: parseInt(key.substring(`${PREFIX}backup_`.length)),
                                storage: 'localStorage'
                            });
                        }
                    }
                } catch (e) {
                    console.warn('StorageUtils: Помилка при пошуку резервних копій в localStorage:', e);
                }
            }

            // Пошук в memoryStorage
            for (const key in memoryStorage) {
                if (Object.prototype.hasOwnProperty.call(memoryStorage, key) &&
                    key.startsWith(`${PREFIX}backup_`) &&
                    !key.endsWith('_meta')) {

                    backupKeys.push({
                        key: key,
                        timestamp: parseInt(key.substring(`${PREFIX}backup_`.length)),
                        storage: 'memoryStorage'
                    });
                }
            }

            // Сортуємо за часом (від найновіших до найстаріших)
            backupKeys.sort((a, b) => b.timestamp - a.timestamp);

            // Видаляємо зайві резервні копії (залишаємо лише 3 останні)
            if (backupKeys.length > 3) {
                const backupsToRemove = backupKeys.slice(3);

                backupsToRemove.forEach(backup => {
                    if (backup.storage === 'localStorage' && config.useLocalStorage) {
                        try {
                            localStorage.removeItem(backup.key);
                            localStorage.removeItem(`${backup.key}_meta`);
                        } catch (e) {
                            console.warn('StorageUtils: Помилка при видаленні старої резервної копії з localStorage:', e);
                        }
                    } else if (backup.storage === 'memoryStorage') {
                        delete memoryStorage[backup.key];
                        delete memoryStorage[`${backup.key}_meta`];
                    }
                });

                if (config.debug) {
                    console.debug(`StorageUtils: Видалено ${backupsToRemove.length} старих резервних копій`);
                }
            }
        } catch (e) {
            console.error('StorageUtils: Помилка при очищенні старих резервних копій:', e);
        }
    }

    /**
     * Відновлення даних з резервної копії
     * @returns {Object} - Результат відновлення
     */
    function restoreFromBackup() {
        try {
            // Знаходимо всі ключі резервних копій
            const backupKeys = [];

            // Пошук в localStorage
            if (config.useLocalStorage) {
                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(`${PREFIX}backup_`) && !key.endsWith('_meta')) {
                            // Отримуємо метадані
                            let metadata = null;
                            try {
                                const metaStr = localStorage.getItem(`${key}_meta`);
                                metadata = metaStr ? JSON.parse(metaStr) : null;
                            } catch (e) {}

                            backupKeys.push({
                                key: key,
                                timestamp: parseInt(key.substring(`${PREFIX}backup_`.length)) || 0,
                                storage: 'localStorage',
                                metadata: metadata
                            });
                        }
                    }
                } catch (e) {
                    console.warn('StorageUtils: Помилка при пошуку резервних копій в localStorage:', e);
                }
            }

            // Пошук в memoryStorage
            for (const key in memoryStorage) {
                if (Object.prototype.hasOwnProperty.call(memoryStorage, key) &&
                    key.startsWith(`${PREFIX}backup_`) &&
                    !key.endsWith('_meta')) {

                    // Отримуємо метадані
                    const metadata = memoryStorage[`${key}_meta`] || null;

                    backupKeys.push({
                        key: key,
                        timestamp: parseInt(key.substring(`${PREFIX}backup_`.length)) || 0,
                        storage: 'memoryStorage',
                        metadata: metadata
                    });
                }
            }

            // Якщо немає резервних копій
            if (backupKeys.length === 0) {
                return {
                    success: false,
                    message: 'Резервні копії не знайдено'
                };
            }

            // Сортуємо за часом (від найновіших до найстаріших)
            backupKeys.sort((a, b) => b.timestamp - a.timestamp);

            // Вибираємо найновішу резервну копію
            const latestBackup = backupKeys[0];
            let backupData = null;

            // Отримуємо дані резервної копії
            if (latestBackup.storage === 'localStorage' && config.useLocalStorage) {
                try {
                    let backupStr = localStorage.getItem(latestBackup.key);

                    // Розпаковуємо, якщо стиснуто
                    if (backupStr && (backupStr.startsWith('__COMPRESSED__:') || backupStr.startsWith('__COMPRESSED_RLE__:'))) {
                        backupStr = decompressString(backupStr);
                    }

                    // Дешифруємо, якщо зашифровано
                    if (backupStr && backupStr.startsWith(ENCRYPTION_MARKER)) {
                        backupStr = decryptString(backupStr);
                    }

                    // Парсимо JSON
                    backupData = JSON.parse(backupStr);
                } catch (e) {
                    console.error('StorageUtils: Помилка при отриманні резервної копії з localStorage:', e);
                }
            } else if (latestBackup.storage === 'memoryStorage') {
                try {
                    let backupStr = memoryStorage[latestBackup.key];

                    // Розпаковуємо, якщо стиснуто
                    if (typeof backupStr === 'string' && (backupStr.startsWith('__COMPRESSED__:') || backupStr.startsWith('__COMPRESSED_RLE__:'))) {
                        backupStr = decompressString(backupStr);
                    }

                    // Дешифруємо, якщо зашифровано
                    if (typeof backupStr === 'string' && backupStr.startsWith(ENCRYPTION_MARKER)) {
                        backupStr = decryptString(backupStr);
                    }

                    // Парсимо JSON
                    backupData = typeof backupStr === 'string' ? JSON.parse(backupStr) : backupStr;
                } catch (e) {
                    console.error('StorageUtils: Помилка при отриманні резервної копії з memoryStorage:', e);
                }
            }

            // Якщо не вдалося отримати дані резервної копії
            if (!backupData) {
                return {
                    success: false,
                    message: 'Не вдалося отримати дані резервної копії'
                };
            }

            // Відновлюємо дані
            let restoredCount = 0;

            for (const key in backupData) {
                if (Object.prototype.hasOwnProperty.call(backupData, key)) {
                    const item = backupData[key];

                    // Зберігаємо значення
                    setItem(removePrefix(key), item.value, {
                        persist: item.source === 'localStorage',
                        sensitive: isSensitiveKey(key)
                    });

                    restoredCount++;
                }
            }

            if (config.debug) {
                console.debug(`StorageUtils: Відновлено ${restoredCount} елементів з резервної копії від ${new Date(latestBackup.timestamp).toLocaleString()}`);
            }

            return {
                success: true,
                message: `Відновлено ${restoredCount} елементів з резервної копії`,
                timestamp: latestBackup.timestamp,
                keys: restoredCount
            };
        } catch (e) {
            console.error('StorageUtils: Помилка при відновленні з резервної копії:', e);

            return {
                success: false,
                message: 'Помилка при відновленні з резервної копії: ' + e.message
            };
        }
    }

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
            sensitive = false,
            compress = null
        } = options;

        try {
            // Перевірка розміру даних перед збереженням
            const valueSize = getDataSize(value);
            if (valueSize > config.maxItemSize) {
                console.error(`StorageUtils: Розмір даних (${formatSize(valueSize)}) перевищує максимально допустимий (${formatSize(config.maxItemSize)})`);
                throw new Error('ITEM_SIZE_EXCEEDED');
            }

            // Підготовка даних для збереження
            let dataToStore;

            // Обробка об'єктів та масивів
            if (typeof value === 'object' && value !== null) {
                dataToStore = JSON.stringify(value);
            } else {
                dataToStore = String(value);
            }

            // Шифруємо чутливі дані, якщо увімкнено шифрування
            const shouldEncrypt = config.encryption && (sensitive || isSensitiveKey(key));
            if (shouldEncrypt) {
                dataToStore = encryptString(dataToStore, key);
            }

            // Стискаємо дані, якщо потрібно
            const shouldCompress = compress || (compress !== false && dataToStore.length > config.compressionThreshold);
            if (shouldCompress) {
                dataToStore = compressString(dataToStore);
            }

            // Метадані для збереження
            const metadata = {
                timestamp: Date.now(),
                expires: expires ? Date.now() + expires : null,
                type: typeof value,
                encrypted: shouldEncrypt,
                compressed: shouldCompress,
                size: valueSize
            };

            // Зберігаємо в localStorage, якщо потрібно персистентне сховище
            if (persist && config.useLocalStorage) {
                try {
                    localStorage.setItem(prefixedKey, dataToStore);
                    localStorage.setItem(`${prefixedKey}_meta`, JSON.stringify(metadata));
                } catch (error) {
                    console.warn(`StorageUtils: Помилка збереження в localStorage: ${error.message}`);
                    storageStats.errorCount++;

                    // Якщо проблема з QUOTA_EXCEEDED, спробуємо очистити старі дані
                    if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                        // Оновлюємо статистику сховища
                        updateStorageStats();

                        // Перевіряємо, чи сховище заповнене більше ніж на 90%
                        if (storageStats.localStorageSize > config.maxStorageSize * 0.9) {
                            // Спробуємо звільнити місце
                            cleanupStorage();

                            // Спробуємо ще раз
                            try {
                                localStorage.setItem(prefixedKey, dataToStore);
                                localStorage.setItem(`${prefixedKey}_meta`, JSON.stringify(metadata));
                            } catch (e) {
                                console.error(`StorageUtils: Не вдалося зберегти дані після очищення: ${e.message}`);
                                config.useLocalStorage = false;
                            }
                        } else {
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
                    storageStats.errorCount++;
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

            // Плануємо створення резервної копії, якщо це важливі дані
            if (IMPORTANT_KEYS.includes(key) || IMPORTANT_KEYS.some(prefix => key.startsWith(prefix + '_'))) {
                // Відкладене створення резервної копії для уникнення частих операцій
                setTimeout(createBackup, 5000);
            }

            return true;
        } catch (error) {
            console.error(`StorageUtils: Помилка збереження даних для ключа ${key}:`, error);
            storageStats.errorCount++;
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
            parse = true,
            sensitive = false
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
                    storageStats.errorCount++;
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
                    storageStats.errorCount++;
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

            // Розпаковуємо стиснуті дані
            if (storedValue && (storedValue.startsWith('__COMPRESSED__:') || storedValue.startsWith('__COMPRESSED_RLE__:'))) {
                storedValue = decompressString(storedValue);
            }

            // Розшифровуємо дані, якщо вони зашифровані
            if (storedValue && storedValue.startsWith(ENCRYPTION_MARKER)) {
                storedValue = decryptString(storedValue, key);
            }

            // Обробка типу даних
            if (parse) {
                try {
                    // Якщо є метадані про тип, використовуємо їх
                    if (metadata && metadata.type) {
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
                    } else {
                        // Інакше намагаємося автоматично визначити тип
                        if (storedValue === 'true') return true;
                        if (storedValue === 'false') return false;
                        if (storedValue === 'null') return null;
                        if (storedValue === 'undefined') return undefined;
                        if (!isNaN(storedValue) && storedValue.trim() !== '') return parseFloat(storedValue);

                        // Спроба розпарсити як JSON
                        try {
                            return JSON.parse(storedValue);
                        } catch (e) {
                            // Якщо не вдалося розпарсити як JSON, повертаємо як є
                            return storedValue;
                        }
                    }
                } catch (e) {
                    console.warn(`StorageUtils: Помилка парсингу даних для ключа ${key}:`, e);
                    return storedValue;
                }
            }

            // Якщо не потрібно парсити, повертаємо як є
            return storedValue;
        } catch (error) {
            console.error(`StorageUtils: Помилка отримання даних для ключа ${key}:`, error);
            storageStats.errorCount++;
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
                    storageStats.errorCount++;
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
                    storageStats.errorCount++;
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
            storageStats.errorCount++;
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
            // Створюємо резервну копію перед очищенням
            try {
                createBackup();
            } catch (e) {
                console.warn('StorageUtils: Помилка створення резервної копії перед очищенням:', e);
            }

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
                        // Спочатку зберігаємо ключі, які потрібно зберегти
                        const itemsToPreserve = {};

                        if (preserveKeys.length > 0) {
                            preserveKeys.forEach(key => {
                                const prefixedKey = addPrefix(key);
                                try {
                                    const value = localStorage.getItem(prefixedKey);
                                    const metaStr = localStorage.getItem(`${prefixedKey}_meta`);
                                    if (value !== null) {
                                        itemsToPreserve[prefixedKey] = value;
                                    }
                                    if (metaStr !== null) {
                                        itemsToPreserve[`${prefixedKey}_meta`] = metaStr;
                                    }
                                } catch (e) {}
                            });
                        }

                        // Очищаємо сховище
                        localStorage.clear();

                        // Відновлюємо збережені ключі
                        for (const key in itemsToPreserve) {
                            if (Object.prototype.hasOwnProperty.call(itemsToPreserve, key)) {
                                localStorage.setItem(key, itemsToPreserve[key]);
                            }
                        }
                    } catch (error) {
                        console.warn(`StorageUtils: Помилка очищення localStorage: ${error.message}`);
                        storageStats.errorCount++;
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
                        // Спочатку зберігаємо ключі, які потрібно зберегти
                        const itemsToPreserve = {};

                        if (preserveKeys.length > 0) {
                            preserveKeys.forEach(key => {
                                const prefixedKey = addPrefix(key);
                                try {
                                    const value = sessionStorage.getItem(prefixedKey);
                                    const metaStr = sessionStorage.getItem(`${prefixedKey}_meta`);
                                    if (value !== null) {
                                        itemsToPreserve[prefixedKey] = value;
                                    }
                                    if (metaStr !== null) {
                                        itemsToPreserve[`${prefixedKey}_meta`] = metaStr;
                                    }
                                } catch (e) {}
                            });
                        }

                        // Очищаємо сховище
                        sessionStorage.clear();

                        // Відновлюємо збережені ключі
                        for (const key in itemsToPreserve) {
                            if (Object.prototype.hasOwnProperty.call(itemsToPreserve, key)) {
                                sessionStorage.setItem(key, itemsToPreserve[key]);
                            }
                        }
                    } catch (error) {
                        console.warn(`StorageUtils: Помилка очищення sessionStorage: ${error.message}`);
                        storageStats.errorCount++;
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

            // Оновлюємо статистику сховища
            updateStorageStats();

            return true;
        } catch (error) {
            console.error('StorageUtils: Помилка очищення сховища:', error);
            storageStats.errorCount++;
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

        // Перевіряємо, чи є ключ частиною важливих ключів
        return preserveKeys.some(preserveKey =>
            normalizedKey.startsWith(preserveKey + '_') ||
            normalizedKey.endsWith('_' + preserveKey)
        );
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
            storageStats.errorCount++;
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
            storageStats.errorCount++;
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
            storageStats.errorCount++;
        }
    }

    /**
     * Очищення старих даних для звільнення місця
     */
    function cleanupStorage() {
        try {
            console.warn('StorageUtils: Спроба очистити сховище від старих даних');

            // Оновлюємо статистику сховища
            updateStorageStats();

            // Спочатку видаляємо прострочені елементи
            clear({ onlyExpired: true });

            // Якщо це не допомогло, видаляємо кешовані дані
            if (storageStats.localStorageSize > config.maxStorageSize * 0.9) {
                // Основні ключі, які потрібно завжди зберігати
                const keysToPreserve = [
                    'telegram_user_id',
                    'auth_token',
                    'auth_token_expiry',
                    'userTokens',
                    'userCoins',
                    'winix_balance',
                    'winix_coins',
                    'language',
                    'theme',
                    'user_id',
                    'referral_code'
                ];

                // Додаємо ключі, які починаються з 'backup_' (резервні копії)
                const backupPrefixes = [];
                if (config.useLocalStorage) {
                    try {
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith(`${PREFIX}backup_`)) {
                                const normalizedKey = key.substring(PREFIX.length);
                                backupPrefixes.push(normalizedKey);
                            }
                        }
                    } catch (e) {}
                }

                // Створюємо повний список ключів для збереження
                const fullPreserveList = [...keysToPreserve, ...backupPrefixes];

                // Видаляємо не важливі дані, зберігаючи важливі
                clear({
                    onlyPrefix: true,
                    preserveKeys: fullPreserveList
                });

                // Оновлюємо статистику після очищення
                updateStorageStats();

                // Якщо все ще не вистачає місця, видаляємо старі резервні копії
                if (storageStats.localStorageSize > config.maxStorageSize * 0.8) {
                    cleanupOldBackups();

                    // Якщо і це не допомогло, видаляємо всі резервні копії, окрім найновішої
                    if (storageStats.localStorageSize > config.maxStorageSize * 0.7) {
                        try {
                            const backupKeys = [];

                            if (config.useLocalStorage) {
                                for (let i = 0; i < localStorage.length; i++) {
                                    const key = localStorage.key(i);
                                    if (key && key.startsWith(`${PREFIX}backup_`) && !key.endsWith('_meta')) {
                                        backupKeys.push({
                                            key: key,
                                            timestamp: parseInt(key.substring(`${PREFIX}backup_`.length)) || 0
                                        });
                                    }
                                }
                            }

                            // Сортуємо за часом (від найновіших до найстаріших)
                            backupKeys.sort((a, b) => b.timestamp - a.timestamp);

                            // Видаляємо всі, крім найновішої
                            if (backupKeys.length > 1) {
                                const backupsToRemove = backupKeys.slice(1);

                                backupsToRemove.forEach(backup => {
                                    localStorage.removeItem(backup.key);
                                    localStorage.removeItem(`${backup.key}_meta`);
                                });

                                if (config.debug) {
                                    console.debug(`StorageUtils: Видалено ${backupsToRemove.length} старих резервних копій`);
                                }
                            }
                        } catch (e) {
                            console.error('StorageUtils: Помилка при видаленні резервних копій:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('StorageUtils: Помилка очищення сховища:', error);
            storageStats.errorCount++;
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
            onlyExpired = false,
            onlySensitive = false
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
                            const normalizedKey = withPrefix ? key : removePrefix(key);

                            // Перевіряємо термін дії, якщо потрібно
                            if (onlyExpired) {
                                const metaKey = `${key}_meta`;
                                const metaStr = localStorage.getItem(metaKey);

                                if (metaStr) {
                                    try {
                                        const metadata = JSON.parse(metaStr);

                                        // Додаємо ключ, тільки якщо він прострочений
                                        if (metadata.expires && metadata.expires < now) {
                                            keys.add(normalizedKey);
                                        }
                                    } catch (e) {
                                        // Ігноруємо помилки парсингу метаданих
                                    }
                                }
                            } else if (onlySensitive) {
                                // Додаємо ключ, тільки якщо він чутливий
                                if (isSensitiveKey(key)) {
                                    keys.add(normalizedKey);
                                }
                            } else {
                                // Додаємо всі ключі
                                keys.add(normalizedKey);
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`StorageUtils: Помилка отримання ключів з localStorage: ${error.message}`);
                    storageStats.errorCount++;
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
                            const normalizedKey = withPrefix ? key : removePrefix(key);

                            // Перевіряємо термін дії, якщо потрібно
                            if (onlyExpired) {
                                const metaKey = `${key}_meta`;
                                const metaStr = sessionStorage.getItem(metaKey);

                                if (metaStr) {
                                    try {
                                        const metadata = JSON.parse(metaStr);

                                        // Додаємо ключ, тільки якщо він прострочений
                                        if (metadata.expires && metadata.expires < now) {
                                            keys.add(normalizedKey);
                                        }
                                    } catch (e) {
                                        // Ігноруємо помилки парсингу метаданих
                                    }
                                }
                            } else if (onlySensitive) {
                                // Додаємо ключ, тільки якщо він чутливий
                                if (isSensitiveKey(key)) {
                                    keys.add(normalizedKey);
                                }
                            } else {
                                // Додаємо всі ключі
                                keys.add(normalizedKey);
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`StorageUtils: Помилка отримання ключів з sessionStorage: ${error.message}`);
                    storageStats.errorCount++;
                }
            }

            // Отримуємо ключі з memoryStorage
            for (const key in memoryStorage) {
                // Пропускаємо ключі метаданих
                if (key.endsWith('_meta')) {
                    continue;
                }

                // Перевіряємо префікс
                if (key.startsWith(PREFIX)) {
                    const normalizedKey = withPrefix ? key : removePrefix(key);

                    // Перевіряємо термін дії, якщо потрібно
                    if (onlyExpired) {
                        const metaKey = `${key}_meta`;
                        const metadata = memoryStorage[metaKey];

                        // Додаємо ключ, тільки якщо він прострочений
                        if (metadata && metadata.expires && metadata.expires < now) {
                            keys.add(normalizedKey);
                        }
                    } else if (onlySensitive) {
                        // Додаємо ключ, тільки якщо він чутливий
                        if (isSensitiveKey(key)) {
                            keys.add(normalizedKey);
                        }
                    } else {
                        // Додаємо всі ключі
                        keys.add(normalizedKey);
                    }
                }
            }

            return Array.from(keys);
        } catch (error) {
            console.error('StorageUtils: Помилка отримання ключів:', error);
            storageStats.errorCount++;
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
     * Встановлення унікального ідентифікатора пристрою
     */
    function setDeviceId() {
        try {
            const deviceIdKey = addPrefix('device_id');
            let deviceId = null;

            // Спробуємо отримати існуючий ідентифікатор
            if (config.useLocalStorage) {
                try {
                    deviceId = localStorage.getItem(deviceIdKey);
                } catch (e) {}
            }

            // Якщо немає, генеруємо новий
            if (!deviceId) {
                const randomPart = Math.random().toString(36).substring(2, 15);
                const timestampPart = Date.now().toString(36);
                deviceId = `${randomPart}_${timestampPart}`;

                // Зберігаємо
                if (config.useLocalStorage) {
                    try {
                        localStorage.setItem(deviceIdKey, deviceId);
                    } catch (e) {
                        console.warn('StorageUtils: Помилка збереження device_id в localStorage:', e);
                    }
                }

                memoryStorage[deviceIdKey] = deviceId;
            }

            return deviceId;
        } catch (e) {
            console.error('StorageUtils: Помилка встановлення device_id:', e);
            return null;
        }
    }

    /**
     * Отримання статистики сховища
     * @returns {Object} Статистика сховища
     */
    function getStorageStats() {
        // Оновлюємо статистику перед поверненням
        updateStorageStats();

        return {
            localStorageSize: storageStats.localStorageSize,
            localStorageSizeFormatted: formatSize(storageStats.localStorageSize),
            sessionStorageSize: storageStats.sessionStorageSize,
            sessionStorageSizeFormatted: formatSize(storageStats.sessionStorageSize),
            memoryStorageSize: storageStats.memoryStorageSize,
            memoryStorageSizeFormatted: formatSize(storageStats.memoryStorageSize),
            totalSize: storageStats.localStorageSize + storageStats.sessionStorageSize + storageStats.memoryStorageSize,
            totalSizeFormatted: formatSize(storageStats.localStorageSize + storageStats.sessionStorageSize + storageStats.memoryStorageSize),
            maxSize: config.maxStorageSize,
            maxSizeFormatted: formatSize(config.maxStorageSize),
            usagePercentage: Math.round((storageStats.localStorageSize / config.maxStorageSize) * 100),
            encryptedItems: storageStats.encryptedItemsCount,
            compressedItems: storageStats.compressedItemsCount,
            errors: storageStats.errorCount,
            lastUpdate: new Date(storageStats.lastUpdate).toISOString(),
            lastBackup: storageStats.lastBackup ? new Date(storageStats.lastBackup).toISOString() : null
        };
    }

    /**
     * Оновлення конфігурації
     * @param {Object} newConfig - Нова конфігурація
     * @returns {Object} Оновлена конфігурація
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

        return Object.assign({}, config);
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

        // Встановлюємо унікальний ідентифікатор пристрою
        setDeviceId();

        // Оновлюємо статистику використання сховища
        updateStorageStats();

        // Спробуємо відновити дані, якщо це необхідно
        setTimeout(() => {
            try {
                // Перевіряємо, чи потрібно відновлення даних
                const needsRestore = getItem('needs_storage_restore', false);
                if (needsRestore) {
                    console.log('StorageUtils: Спроба відновлення даних з резервної копії...');
                    const result = restoreFromBackup();

                    if (result.success) {
                        console.log(`StorageUtils: Успішно відновлено ${result.keys} елементів з резервної копії`);
                        setItem('needs_storage_restore', false);
                    } else {
                        console.warn(`StorageUtils: Не вдалося відновити дані: ${result.message}`);
                    }
                }
            } catch (e) {
                console.error('StorageUtils: Помилка при спробі відновлення даних:', e);
            }
        }, 1000);
    })();

    // Періодичне створення резервних копій (кожні 24 години)
    setInterval(createBackup, config.backupInterval);

    // Періодичне оновлення статистики (кожні 30 хвилин)
    setInterval(updateStorageStats, 30 * 60 * 1000);

    // Періодичне очищення проcтрочених елементів (кожні 2 години)
    setInterval(() => clear({ onlyExpired: true }), 2 * 60 * 60 * 1000);

    // Публічний API
    return {
        setItem,
        getItem,
        removeItem,
        clear,
        getKeys,
        updateConfig,
        getStorageStats,
        createBackup,
        restoreFromBackup,
        config: Object.assign({}, config) // Повертаємо копію конфігурації
    };
})();