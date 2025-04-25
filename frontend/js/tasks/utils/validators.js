/**
 * Validators - оптимізовані утиліти для валідації різних типів даних
 * Відповідає за:
 * - Перевірку коректності різних форматів даних
 * - Централізовану валідацію форм та введених користувачем даних
 * - Валідацію складних структур даних з агрегацією помилок
 * - Кешування результатів та оптимізацію продуктивності
 */

window.Validators = (function() {
    // Налаштування за замовчуванням
    const DEFAULT_CONFIG = {
        // Локаль за замовчуванням для повідомлень про помилки
        locale: 'uk-UA',

        // Глобальні налаштування валідації
        strictMode: true, // Суворий режим

        // Параметри валідації для різних типів даних
        number: {
            allowString: true, // Дозволяти рядки як числа
            allowInfinity: false, // Дозволяти Infinity
            allowNaN: false // Дозволяти NaN
        },

        string: {
            trim: true, // Обрізати пробіли перед перевіркою
            allowEmpty: false // Дозволяти порожні рядки
        },

        email: {
            allowDomainLiterals: false, // Дозволяти домени в квадратних дужках
            allowQuotedIdentifiers: true, // Дозволяти ідентифікатори в лапках
            checkDNS: false // Перевіряти DNS-запис (лише для серверного JavaScript)
        },

        url: {
            requireProtocol: true, // Вимагати протокол
            allowedProtocols: ['http:', 'https:'], // Дозволені протоколи
            allowRelative: false // Дозволяти відносні URL
        },

        date: {
            allowString: true, // Дозволяти рядки як дати
            minDate: null, // Мінімальна допустима дата
            maxDate: null // Максимальна допустима дата
        },

        phone: {
            requireCountryCode: false, // Вимагати код країни
            format: 'any', // 'any', 'international', 'local'
            countryCode: '+38' // Код країни за замовчуванням (Україна)
        },

        // Налаштування форматів повідомлень про помилки
        errorMessages: {
            'uk-UA': {
                empty: 'Поле не може бути порожнім',
                invalid: 'Некоректне значення',
                invalidType: 'Некоректний тип даних',
                notNumber: 'Значення має бути числом',
                notInteger: 'Значення має бути цілим числом',
                notFloat: 'Значення має бути числом з плаваючою комою',
                notEmail: 'Некоректний формат електронної пошти',
                notUrl: 'Некоректний URL',
                notPhone: 'Некоректний формат телефонного номера',
                notDate: 'Некоректний формат дати',
                notInRange: 'Значення поза допустимим діапазоном',
                tooShort: 'Значення занадто коротке',
                tooLong: 'Значення занадто довге',
                patternMismatch: 'Значення не відповідає очікуваному формату',
                valueMismatch: 'Значення не співпадає',
                invalidFormat: 'Некоректний формат',
                required: 'Обов\'язкове поле'
            },
            'en-US': {
                empty: 'Field cannot be empty',
                invalid: 'Invalid value',
                invalidType: 'Invalid data type',
                notNumber: 'Value must be a number',
                notInteger: 'Value must be an integer',
                notFloat: 'Value must be a floating-point number',
                notEmail: 'Invalid email format',
                notUrl: 'Invalid URL',
                notPhone: 'Invalid phone number format',
                notDate: 'Invalid date format',
                notInRange: 'Value is out of allowed range',
                tooShort: 'Value is too short',
                tooLong: 'Value is too long',
                patternMismatch: 'Value does not match the expected pattern',
                valueMismatch: 'Values do not match',
                invalidFormat: 'Invalid format',
                required: 'This field is required'
            }
        }
    };

    // Поточна конфігурація
    let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // Кеш результатів валідації
    const validationCache = {};

    // Максимальний розмір кешу
    const MAX_CACHE_SIZE = 1000;

    // Лічильник використання кешу для LRU (Least Recently Used) стратегії
    let cacheCounter = 0;

    /**
     * Оновлення конфігурації валідаторів
     * @param {Object} newConfig - Нові параметри конфігурації
     * @returns {Object} Поточна конфігурація
     */
    function updateConfig(newConfig = {}) {
        // Рекурсивне об'єднання конфігурацій
        function deepMerge(target, source) {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    // Якщо властивість є об'єктом, рекурсивно об'єднуємо
                    if (!target[key]) target[key] = {};
                    deepMerge(target[key], source[key]);
                } else {
                    // Інакше просто копіюємо властивість
                    if (source[key] !== undefined) {
                        target[key] = source[key];
                    }
                }
            }
            return target;
        }

        // Оновлюємо конфігурацію
        config = deepMerge(JSON.parse(JSON.stringify(config)), newConfig);

        // Очищаємо кеш валідацій при зміні конфігурації
        clearValidationCache();

        return config;
    }

    /**
     * Скидання конфігурації до значень за замовчуванням
     * @returns {Object} Конфігурація за замовчуванням
     */
    function resetConfig() {
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

        // Очищаємо кеш валідацій
        clearValidationCache();

        return config;
    }

    /**
     * Отримання поточної локалі
     * @returns {string} Код поточної локалі
     */
    function getCurrentLocale() {
        return config.locale;
    }

    /**
     * Зміна поточної локалі
     * @param {string} locale - Новий код локалі
     * @returns {boolean} Успішність зміни локалі
     */
    function setLocale(locale) {
        if (!locale || typeof locale !== 'string' || !config.errorMessages[locale]) {
            return false;
        }

        config.locale = locale;
        return true;
    }

    /**
     * Додавання нової локалі з повідомленнями про помилки
     * @param {string} locale - Код локалі
     * @param {Object} messages - Повідомлення про помилки
     * @returns {boolean} Успішність додавання локалі
     */
    function addLocaleMessages(locale, messages) {
        if (!locale || typeof locale !== 'string' || !messages || typeof messages !== 'object') {
            return false;
        }

        // Якщо локаль вже існує, об'єднуємо повідомлення
        if (config.errorMessages[locale]) {
            config.errorMessages[locale] = {
                ...config.errorMessages[locale],
                ...messages
            };
        } else {
            // Інакше створюємо нову локаль
            config.errorMessages[locale] = {
                ...messages
            };
        }

        return true;
    }

    /**
     * Отримання повідомлення про помилку для поточної локалі
     * @param {string} key - Ключ повідомлення
     * @param {Object} params - Параметри для підстановки в повідомлення
     * @param {string} locale - Локаль (опціонально)
     * @returns {string} Локалізоване повідомлення про помилку
     */
    function getErrorMessage(key, params = {}, locale = config.locale) {
        // Отримуємо повідомлення для поточної локалі або для 'uk-UA' за замовчуванням
        const messages = config.errorMessages[locale] || config.errorMessages['uk-UA'];

        if (!messages || !messages[key]) {
            // Якщо повідомлення не знайдено, повертаємо ключ як запасний варіант
            return key;
        }

        // Отримуємо повідомлення
        let message = messages[key];

        // Якщо є пробуємо використати WinixLanguage
        if (window.WinixLanguage && typeof window.WinixLanguage.get === 'function') {
            const translatedMessage = window.WinixLanguage.get(`validators.${key}`, params);
            if (translatedMessage) {
                return translatedMessage;
            }
        }

        // Підставляємо параметри
        for (const param in params) {
            if (Object.prototype.hasOwnProperty.call(params, param)) {
                message = message.replace(`{${param}}`, params[param]);
            }
        }

        return message;
    }

    /**
     * Очищення кешу валідацій
     */
    function clearValidationCache() {
        for (const key in validationCache) {
            delete validationCache[key];
        }
        cacheCounter = 0;
    }

    /**
     * Кешування результату валідації
     * @param {string} key - Ключ кешу
     * @param {*} value - Значення для збереження
     */
    function cacheValidationResult(key, value) {
        // Якщо кеш переповнено, видаляємо найстаріший елемент
        if (Object.keys(validationCache).length >= MAX_CACHE_SIZE) {
            // Знаходимо найстаріший елемент
            let oldestKey = null;
            let oldestCounter = Infinity;

            for (const cacheKey in validationCache) {
                if (validationCache[cacheKey].counter < oldestCounter) {
                    oldestCounter = validationCache[cacheKey].counter;
                    oldestKey = cacheKey;
                }
            }

            // Видаляємо найстаріший елемент
            if (oldestKey) {
                delete validationCache[oldestKey];
            }
        }

        // Зберігаємо результат в кеш
        validationCache[key] = {
            value: value,
            counter: ++cacheCounter,
            timestamp: Date.now()
        };
    }

    /**
     * Отримання результату валідації з кешу
     * @param {string} key - Ключ кешу
     * @returns {*} Значення з кешу або undefined
     */
    function getCachedValidationResult(key) {
        const cachedResult = validationCache[key];

        if (cachedResult) {
            // Оновлюємо лічильник використання для LRU стратегії
            cachedResult.counter = ++cacheCounter;
            return cachedResult.value;
        }

        return undefined;
    }

    /**
     * Перевірка на порожнє значення
     * @param {*} value - Значення для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {boolean} Результат перевірки
     */
    function isEmpty(value, options = {}) {
        const { trim = config.string.trim } = options;

        if (value === null || value === undefined) {
            return true;
        }

        if (typeof value === 'string') {
            return trim ? value.trim() === '' : value === '';
        }

        if (Array.isArray(value)) {
            return value.length === 0;
        }

        if (typeof value === 'object') {
            return Object.keys(value).length === 0;
        }

        return false;
    }

    /**
     * Перевірка, чи значення є числом
     * @param {*} value - Значення для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function isNumber(value, options = {}) {
        // Об'єднуємо опції з конфігурацією за замовчуванням
        const opts = { ...config.number, ...options };
        const {
            allowString,
            allowInfinity,
            allowNaN,
            min,
            max
        } = opts;

        // Формуємо ключ кешу
        const cacheKey = `isNumber_${value}_${JSON.stringify(opts)}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null
        };

        // Перевірка на null та undefined
        if (value === null || value === undefined) {
            result.error = getErrorMessage('empty');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Конвертуємо рядок в число, якщо дозволено
        let number = value;
        if (allowString && typeof value === 'string') {
            number = Number(value);
        }

        // Перевірка, чи значення є числом
        if (typeof number !== 'number') {
            result.error = getErrorMessage('notNumber');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Перевірка на NaN
        if (isNaN(number) && !allowNaN) {
            result.error = getErrorMessage('notNumber');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Перевірка на Infinity
        if (!isFinite(number) && !allowInfinity) {
            result.error = getErrorMessage('notNumber');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Перевірка діапазону, якщо вказано
        if (min !== undefined && number < min) {
            result.error = getErrorMessage('notInRange', { min, max: max || 'Infinity' });
            cacheValidationResult(cacheKey, result);
            return result;
        }

        if (max !== undefined && number > max) {
            result.error = getErrorMessage('notInRange', { min: min || '-Infinity', max });
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Якщо всі перевірки пройдені
        result.valid = true;
        cacheValidationResult(cacheKey, result);
        return result;
    }

    /**
     * Перевірка, чи значення є цілим числом
     * @param {*} value - Значення для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function isInteger(value, options = {}) {
        // Об'єднуємо опції з конфігурацією за замовчуванням
        const opts = { ...config.number, ...options };
        const {
            allowString,
            min = Number.MIN_SAFE_INTEGER,
            max = Number.MAX_SAFE_INTEGER
        } = opts;

        // Формуємо ключ кешу
        const cacheKey = `isInteger_${value}_${JSON.stringify(opts)}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null
        };

        // Перевірка, чи значення є числом
        const numberResult = isNumber(value, {
            allowString,
            allowInfinity: false,
            allowNaN: false
        });

        if (!numberResult.valid) {
            result.error = numberResult.error;
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Конвертуємо рядок в число, якщо потрібно
        let number = value;
        if (allowString && typeof value === 'string') {
            number = Number(value);
        }

        // Перевірка, чи число є цілим
        if (!Number.isInteger(number)) {
            result.error = getErrorMessage('notInteger');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Перевірка діапазону
        if (number < min) {
            result.error = getErrorMessage('notInRange', { min, max });
            cacheValidationResult(cacheKey, result);
            return result;
        }

        if (number > max) {
            result.error = getErrorMessage('notInRange', { min, max });
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Якщо всі перевірки пройдені
        result.valid = true;
        cacheValidationResult(cacheKey, result);
        return result;
    }

    /**
     * Перевірка, чи значення є дійсним числом
     * @param {*} value - Значення для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function isFloat(value, options = {}) {
        // Об'єднуємо опції з конфігурацією за замовчуванням
        const opts = { ...config.number, ...options };
        const {
            allowString,
            min = -Number.MAX_VALUE,
            max = Number.MAX_VALUE,
            decimals = null // Максимальна кількість знаків після коми
        } = opts;

        // Формуємо ключ кешу
        const cacheKey = `isFloat_${value}_${JSON.stringify(opts)}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null
        };

        // Перевірка, чи значення є числом
        const numberResult = isNumber(value, {
            allowString,
            allowInfinity: false,
            allowNaN: false
        });

        if (!numberResult.valid) {
            result.error = numberResult.error;
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Конвертуємо рядок в число, якщо потрібно
        let number = value;
        if (allowString && typeof value === 'string') {
            number = Number(value);
        }

        // Перевірка діапазону
        if (number < min) {
            result.error = getErrorMessage('notInRange', { min, max });
            cacheValidationResult(cacheKey, result);
            return result;
        }

        if (number > max) {
            result.error = getErrorMessage('notInRange', { min, max });
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Перевірка кількості знаків після коми
        if (decimals !== null) {
            const decimalPlaces = getDecimalPlaces(number);
            if (decimalPlaces > decimals) {
                result.error = getErrorMessage('invalidFormat', {
                    format: `max ${decimals} decimal places`
                });
                cacheValidationResult(cacheKey, result);
                return result;
            }
        }

        // Якщо всі перевірки пройдені
        result.valid = true;
        cacheValidationResult(cacheKey, result);
        return result;
    }

    /**
     * Отримання кількості знаків після коми
     * @param {number} number - Число для перевірки
     * @returns {number} Кількість знаків після коми
     */
    function getDecimalPlaces(number) {
        const str = number.toString();
        const decimalPos = str.indexOf('.');

        return decimalPos === -1 ? 0 : str.length - decimalPos - 1;
    }

    /**
     * Перевірка на валідний email
     * @param {string} email - Email для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function isEmail(email, options = {}) {
        // Об'єднуємо опції з конфігурацією за замовчуванням
        const opts = { ...config.email, ...options };
        const {
            allowDomainLiterals,
            allowQuotedIdentifiers,
            checkDNS
        } = opts;

        // Формуємо ключ кешу
        const cacheKey = `isEmail_${email}_${JSON.stringify(opts)}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null
        };

        if (typeof email !== 'string') {
            result.error = getErrorMessage('invalidType');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        if (email.trim() === '') {
            result.error = getErrorMessage('empty');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Базовий регулярний вираз для перевірки email
        let emailRegex;

        if (allowQuotedIdentifiers && allowDomainLiterals) {
            // RFC 5322 сумісний вираз
            emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        } else if (allowQuotedIdentifiers) {
            // Дозволяємо ідентифікатори в лапках, але не доменні літерали
            emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,})$/;
        } else if (allowDomainLiterals) {
            // Дозволяємо доменні літерали, але не ідентифікатори в лапках
            emailRegex = /^[^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        } else {
            // Спрощений регулярний вираз для перевірки
            emailRegex = /^[^@\s]+@([^@\s]+\.)+[^@\s]+$/;
        }

        // Перевірка регулярним виразом
        if (!emailRegex.test(email.trim())) {
            result.error = getErrorMessage('notEmail');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Якщо всі перевірки пройдені
        result.valid = true;
        cacheValidationResult(cacheKey, result);
        return result;
    }

    /**
     * Перевірка на валідний URL
     * @param {string} url - URL для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function isUrl(url, options = {}) {
        // Об'єднуємо опції з конфігурацією за замовчуванням
        const opts = { ...config.url, ...options };
        const {
            requireProtocol,
            allowedProtocols,
            allowRelative
        } = opts;

        // Формуємо ключ кешу
        const cacheKey = `isUrl_${url}_${JSON.stringify(opts)}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null
        };

        if (typeof url !== 'string') {
            result.error = getErrorMessage('invalidType');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        if (url.trim() === '') {
            result.error = getErrorMessage('empty');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Для відносних URL
        if (allowRelative && url.startsWith('/')) {
            if (/^\/[^\/]/.test(url)) {
                result.valid = true;
                cacheValidationResult(cacheKey, result);
                return result;
            }
        }

        try {
            // Перевіряємо URL за допомогою конструктора URL
            const urlObj = new URL(url);

            // Перевірка протоколу
            if (requireProtocol && !allowedProtocols.includes(urlObj.protocol)) {
                result.error = getErrorMessage('notUrl', { allowedProtocols: allowedProtocols.join(', ') });
                cacheValidationResult(cacheKey, result);
                return result;
            }

            // Якщо всі перевірки пройдені
            result.valid = true;
            cacheValidationResult(cacheKey, result);
            return result;
        } catch (error) {
            result.error = getErrorMessage('notUrl');
            cacheValidationResult(cacheKey, result);
            return result;
        }
    }

    /**
     * Перевірка на валідний телефонний номер
     * @param {string} phone - Телефонний номер для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function isPhone(phone, options = {}) {
        // Об'єднуємо опції з конфігурацією за замовчуванням
        const opts = { ...config.phone, ...options };
        const {
            requireCountryCode,
            format,
            countryCode
        } = opts;

        // Формуємо ключ кешу
        const cacheKey = `isPhone_${phone}_${JSON.stringify(opts)}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null
        };

        if (typeof phone !== 'string') {
            result.error = getErrorMessage('invalidType');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        if (phone.trim() === '') {
            result.error = getErrorMessage('empty');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Видаляємо всі нецифрові символи
        const digitsOnly = phone.replace(/\D/g, '');

        // Українські номери повинні бути довжиною 12 цифр з кодом країни або 10 без нього
        switch (format) {
            case 'international':
                // Для міжнародного формату
                if (requireCountryCode) {
                    // Починається з коду країни (напр. 380 для України)
                    if (!(digitsOnly.length === 12 && digitsOnly.startsWith('380'))) {
                        result.error = getErrorMessage('notPhone', { format: 'міжнародний' });
                        cacheValidationResult(cacheKey, result);
                        return result;
                    }
                } else {
                    // Може бути з кодом країни або без
                    if (!(digitsOnly.length === 12 && digitsOnly.startsWith('380')) &&
                        !(digitsOnly.length === 10 && digitsOnly.startsWith('0'))) {
                        result.error = getErrorMessage('notPhone', { format: 'міжнародний' });
                        cacheValidationResult(cacheKey, result);
                        return result;
                    }
                }
                break;

            case 'local':
                // Тільки локальний формат
                if (!(digitsOnly.length === 10 && digitsOnly.startsWith('0'))) {
                    result.error = getErrorMessage('notPhone', { format: 'локальний' });
                    cacheValidationResult(cacheKey, result);
                    return result;
                }
                break;

            case 'any':
            default:
                // Будь-який формат
                if (!(digitsOnly.length === 12 && digitsOnly.startsWith('380')) &&
                    !(digitsOnly.length === 10 && digitsOnly.startsWith('0'))) {
                    result.error = getErrorMessage('notPhone');
                    cacheValidationResult(cacheKey, result);
                    return result;
                }
        }

        // Якщо всі перевірки пройдені
        result.valid = true;
        cacheValidationResult(cacheKey, result);
        return result;
    }

    /**
     * Перевірка на валідну дату
     * @param {*} date - Дата для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function isDate(date, options = {}) {
        // Об'єднуємо опції з конфігурацією за замовчуванням
        const opts = { ...config.date, ...options };
        const {
            allowString,
            minDate,
            maxDate,
            format = null // Для перевірки рядкового формату (наприклад, 'dd.MM.yyyy')
        } = opts;

        // Формуємо ключ кешу
        const cacheKey = `isDate_${date}_${JSON.stringify(opts)}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null
        };

        // Перевірка, чи об'єкт є датою
        if (date instanceof Date) {
            if (isNaN(date.getTime())) {
                result.error = getErrorMessage('notDate');
                cacheValidationResult(cacheKey, result);
                return result;
            }

            const isInRange = isDateInRange(date, minDate, maxDate);
            if (!isInRange.valid) {
                result.error = isInRange.error;
                cacheValidationResult(cacheKey, result);
                return result;
            }

            result.valid = true;
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Перевірка рядка
        if (allowString && typeof date === 'string') {
            // Якщо вказано формат, перевіряємо його
            if (format) {
                const isValidFormat = isValidDateFormat(date, format);
                if (!isValidFormat) {
                    result.error = getErrorMessage('invalidFormat', { format });
                    cacheValidationResult(cacheKey, result);
                    return result;
                }

                const parsedDate = parseDate(date, format);
                if (!parsedDate) {
                    result.error = getErrorMessage('notDate');
                    cacheValidationResult(cacheKey, result);
                    return result;
                }

                const isInRange = isDateInRange(parsedDate, minDate, maxDate);
                if (!isInRange.valid) {
                    result.error = isInRange.error;
                    cacheValidationResult(cacheKey, result);
                    return result;
                }

                result.valid = true;
                cacheValidationResult(cacheKey, result);
                return result;
            }

            // Спроба перетворити рядок у дату за замовчуванням
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
                const isInRange = isDateInRange(parsedDate, minDate, maxDate);
                if (!isInRange.valid) {
                    result.error = isInRange.error;
                    cacheValidationResult(cacheKey, result);
                    return result;
                }

                result.valid = true;
                cacheValidationResult(cacheKey, result);
                return result;
            }

            // Пробуємо парсити український формат дати (дд.мм.рррр)
            const ukFormat = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
            const match = date.match(ukFormat);

            if (match) {
                const day = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1;
                const year = parseInt(match[3], 10);

                const dateObj = new Date(year, month, day);

                // Перевірка, чи дата валідна
                if (dateObj.getFullYear() === year && dateObj.getMonth() === month && dateObj.getDate() === day) {
                    const isInRange = isDateInRange(dateObj, minDate, maxDate);
                    if (!isInRange.valid) {
                        result.error = isInRange.error;
                        cacheValidationResult(cacheKey, result);
                        return result;
                    }

                    result.valid = true;
                    cacheValidationResult(cacheKey, result);
                    return result;
                }
            }
        }

        result.error = getErrorMessage('notDate');
        cacheValidationResult(cacheKey, result);
        return result;
    }

    /**
     * Перевірка, чи дата входить в діапазон
     * @param {Date} date - Дата для перевірки
     * @param {Date|null} minDate - Мінімальна дата
     * @param {Date|null} maxDate - Максимальна дата
     * @returns {Object} Результат перевірки
     */
    function isDateInRange(date, minDate, maxDate) {
        const result = {
            valid: false,
            error: null
        };

        if (!date || isNaN(date.getTime())) {
            result.error = getErrorMessage('notDate');
            return result;
        }

        // Перетворюємо рядки на дати
        let minDateObj = minDate;
        let maxDateObj = maxDate;

        if (minDate && typeof minDate === 'string') {
            minDateObj = new Date(minDate);
        }

        if (maxDate && typeof maxDate === 'string') {
            maxDateObj = new Date(maxDate);
        }

        // Перевірка мінімальної дати
        if (minDateObj && date < minDateObj) {
            const minDateStr = minDateObj.toLocaleDateString();
            result.error = getErrorMessage('notInRange', { min: minDateStr, max: maxDate ? new Date(maxDate).toLocaleDateString() : 'Infinity' });
            return result;
        }

        // Перевірка максимальної дати
        if (maxDateObj && date > maxDateObj) {
            const maxDateStr = maxDateObj.toLocaleDateString();
            result.error = getErrorMessage('notInRange', { min: minDate ? new Date(minDate).toLocaleDateString() : '-Infinity', max: maxDateStr });
            return result;
        }

        result.valid = true;
        return result;
    }

    /**
     * Перевірка, чи рядок відповідає формату дати
     * @param {string} dateStr - Рядок з датою
     * @param {string} format - Формат дати
     * @returns {boolean} Результат перевірки
     */
    function isValidDateFormat(dateStr, format) {
        // Конвертуємо формат у регулярний вираз
        let regex = format
            .replace(/dd/g, '(0[1-9]|[12][0-9]|3[01])')
            .replace(/MM/g, '(0[1-9]|1[012])')
            .replace(/yyyy/g, '\\d{4}')
            .replace(/yy/g, '\\d{2}');

        // Екрануємо спеціальні символи
        regex = regex.replace(/[.\/\-\\]/g, '\\$&');

        const re = new RegExp(`^${regex}$`);
        return re.test(dateStr);
    }

    /**
     * Парсинг дати у вказаному форматі
     * @param {string} dateStr - Рядок з датою
     * @param {string} format - Формат дати
     * @returns {Date|null} Об'єкт Date або null
     */
    function parseDate(dateStr, format) {
        // Отримуємо позиції компонентів дати
        const dayPos = format.indexOf('dd');
        const monthPos = format.indexOf('MM');
        const yearPos = format.indexOf('yyyy') !== -1 ? format.indexOf('yyyy') : format.indexOf('yy');

        // Отримуємо розділювачі
        const separators = format.match(/[^dMy]/g) || [];
        if (separators.length === 0) {
            return null;
        }

        const separator = separators[0];
        const parts = dateStr.split(separator);

        if (parts.length !== 3) {
            return null;
        }

        // Визначаємо порядок компонентів
        const positions = [
            { type: 'day', pos: dayPos },
            { type: 'month', pos: monthPos },
            { type: 'year', pos: yearPos }
        ].sort((a, b) => a.pos - b.pos);

        // Отримуємо компоненти дати
        const day = parseInt(parts[positions.findIndex(p => p.type === 'day')], 10);
        const month = parseInt(parts[positions.findIndex(p => p.type === 'month')], 10) - 1;
        let year = parseInt(parts[positions.findIndex(p => p.type === 'year')], 10);

        // Конвертуємо двоцифровий рік у чотирицифровий
        if (year < 100 && format.indexOf('yy') !== -1 && format.indexOf('yyyy') === -1) {
            const currentYear = new Date().getFullYear();
            const century = Math.floor(currentYear / 100) * 100;

            if (year > currentYear % 100) {
                year = century - 100 + year;
            } else {
                year = century + year;
            }
        }

        // Створюємо об'єкт Date
        const date = new Date(year, month, day);

        // Перевіряємо, чи дата валідна
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
            return date;
        }

        return null;
    }

    /**
     * Перевірка на валідний UUID
     * @param {string} uuid - UUID для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function isUuid(uuid, options = {}) {
        const { version = 'any' } = options;

        // Формуємо ключ кешу
        const cacheKey = `isUuid_${uuid}_${JSON.stringify(options)}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null
        };

        if (typeof uuid !== 'string') {
            result.error = getErrorMessage('invalidType');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        if (uuid.trim() === '') {
            result.error = getErrorMessage('empty');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Підтримка різних форматів UUID
        let pattern;

        if (version === 'any') {
            pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        } else if (version === 'v1') {
            pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        } else if (version === 'v2') {
            pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-2[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        } else if (version === 'v3') {
            pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        } else if (version === 'v4') {
            pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        } else if (version === 'v5') {
            pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        } else if (version === 'noHyphens') {
            pattern = /^[0-9a-f]{32}$/i;
        } else if (version === 'braced') {
            pattern = /^\{[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\}$/i;
        } else {
            result.error = getErrorMessage('invalidFormat', { format: version });
            cacheValidationResult(cacheKey, result);
            return result;
        }

        if (!pattern.test(uuid)) {
            result.error = getErrorMessage('invalidFormat', { format: `UUID ${version}` });
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Якщо всі перевірки пройдені
        result.valid = true;
        cacheValidationResult(cacheKey, result);
        return result;
    }

    /**
     * Перевірка, чи рядок є JSON
     * @param {string} json - Рядок для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function isJson(json, options = {}) {
        const { schema = null } = options;

        // Формуємо ключ кешу (без schema для економії місця)
        const cacheKey = `isJson_${json}_${schema ? 'withSchema' : 'noSchema'}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null,
            data: null
        };

        if (typeof json !== 'string') {
            result.error = getErrorMessage('invalidType');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        if (json.trim() === '') {
            result.error = getErrorMessage('empty');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        try {
            const parsedData = JSON.parse(json);
            result.data = parsedData;

            // Якщо вказана схема для валідації
            if (schema) {
                const validationResult = validateObject(parsedData, schema);
                if (!validationResult.valid) {
                    result.error = validationResult.errors.join('; ');
                    cacheValidationResult(cacheKey, result);
                    return result;
                }
            }

            // Якщо всі перевірки пройдені
            result.valid = true;
            cacheValidationResult(cacheKey, result);
            return result;
        } catch (error) {
            result.error = getErrorMessage('invalidFormat', { format: 'JSON' });
            cacheValidationResult(cacheKey, result);
            return result;
        }
    }

    /**
     * Перевірка на валідний ID Telegram
     * @param {string|number} id - ID для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function isTelegramId(id, options = {}) {
        // Формуємо ключ кешу
        const cacheKey = `isTelegramId_${id}_${JSON.stringify(options)}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null
        };

        // Конвертуємо в рядок
        const idStr = String(id);

        // Telegram ID повинен бути цифровим значенням довжиною 7-12 цифр
        if (!/^[0-9]{7,12}$/.test(idStr)) {
            result.error = getErrorMessage('invalidFormat', { format: 'Telegram ID' });
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Якщо всі перевірки пройдені
        result.valid = true;
        cacheValidationResult(cacheKey, result);
        return result;
    }

    /**
     * Перевірка, чи значення входить у список дозволених значень
     * @param {*} value - Значення для перевірки
     * @param {Array} allowedValues - Список дозволених значень
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function isOneOf(value, allowedValues, options = {}) {
        const { caseSensitive = true } = options;

        // Формуємо ключ кешу
        const cacheKey = `isOneOf_${value}_${JSON.stringify(allowedValues)}_${JSON.stringify(options)}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null
        };

        if (!Array.isArray(allowedValues)) {
            result.error = getErrorMessage('invalidType', { type: 'allowedValues' });
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Для рядків з ігноруванням регістру
        if (!caseSensitive && typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            const hasMatch = allowedValues.some(allowedValue => {
                return typeof allowedValue === 'string' && allowedValue.toLowerCase() === lowerValue;
            });

            if (hasMatch) {
                result.valid = true;
                cacheValidationResult(cacheKey, result);
                return result;
            }
        } else {
            // Звичайна перевірка включення
            if (allowedValues.includes(value)) {
                result.valid = true;
                cacheValidationResult(cacheKey, result);
                return result;
            }
        }

        result.error = getErrorMessage('valueMismatch', { allowed: allowedValues.join(', ') });
        cacheValidationResult(cacheKey, result);
        return result;
    }

    /**
     * Перевірка, чи задовольняє значення регулярному виразу
     * @param {string} value - Значення для перевірки
     * @param {RegExp|string} pattern - Регулярний вираз
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function matchesPattern(value, pattern, options = {}) {
        const { trim = config.string.trim } = options;

        // Формуємо ключ кешу
        const cacheKey = `matchesPattern_${value}_${pattern}_${JSON.stringify(options)}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null
        };

        if (typeof value !== 'string') {
            result.error = getErrorMessage('invalidType');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Обрізаємо пробіли, якщо потрібно
        const trimmedValue = trim ? value.trim() : value;

        // Перетворюємо рядок у регулярний вираз, якщо потрібно
        let regex = pattern;
        if (typeof pattern === 'string') {
            try {
                // Видобуваємо флаги з рядка, якщо вони є
                const matches = pattern.match(/^\/(.*)\/([gimuy]*)$/);
                if (matches) {
                    regex = new RegExp(matches[1], matches[2]);
                } else {
                    regex = new RegExp(pattern);
                }
            } catch (error) {
                result.error = getErrorMessage('invalidFormat', { format: 'Regular Expression' });
                cacheValidationResult(cacheKey, result);
                return result;
            }
        }

        // Перевіряємо, чи значення відповідає регулярному виразу
        if (!regex.test(trimmedValue)) {
            result.error = getErrorMessage('patternMismatch', { pattern: pattern.toString() });
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Якщо всі перевірки пройдені
        result.valid = true;
        cacheValidationResult(cacheKey, result);
        return result;
    }

    /**
     * Перевірка довжини рядка
     * @param {string} value - Рядок для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки
     */
    function hasLength(value, options = {}) {
        const {
            min,
            max,
            trim = config.string.trim,
            exact = null
        } = options;

        // Формуємо ключ кешу
        const cacheKey = `hasLength_${value}_${JSON.stringify(options)}`;

        // Перевіряємо кеш
        const cachedResult = getCachedValidationResult(cacheKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Результат валідації
        const result = {
            valid: false,
            error: null
        };

        if (typeof value !== 'string') {
            result.error = getErrorMessage('invalidType');
            cacheValidationResult(cacheKey, result);
            return result;
        }

        // Обрізаємо пробіли, якщо потрібно
        const stringToCheck = trim ? value.trim() : value;
        const length = stringToCheck.length;

        // Перевірка точної довжини
        if (exact !== null) {
            if (length !== exact) {
                result.error = getErrorMessage('invalidLength', { expected: exact, actual: length });
                cacheValidationResult(cacheKey, result);
                return result;
            }
        } else {
            // Перевірка мінімальної довжини
            if (min !== undefined && length < min) {
                result.error = getErrorMessage('tooShort', { min, current: length });
                cacheValidationResult(cacheKey, result);
                return result;
            }

            // Перевірка максимальної довжини
            if (max !== undefined && length > max) {
                result.error = getErrorMessage('tooLong', { max, current: length });
                cacheValidationResult(cacheKey, result);
                return result;
            }
        }

        // Якщо всі перевірки пройдені
        result.valid = true;
        cacheValidationResult(cacheKey, result);
        return result;
    }

    /**
     * Перевірка, чи значення є об'єктом, що задовольняє схему
     * @param {*} value - Значення для перевірки
     * @param {Object} schema - Схема об'єкта
     * @param {Object} options - Опції перевірки
     * @returns {Object} Результат перевірки { valid: boolean, errors: Array }
     */
    function validateObject(value, schema, options = {}) {
        const { strictMode = config.strictMode, firstErrorOnly = false } = options;

        // Не кешуємо результати validateObject через потенційно складні схеми

        // Результат валідації
        const result = {
            valid: false,
            errors: [],
            details: {}
        };

        // Перевірка, чи value є об'єктом
        if (typeof value !== 'object' || value === null) {
            result.errors.push(getErrorMessage('invalidType', { expected: 'object' }));
            return result;
        }

        // Перевіряємо кожне поле схеми
        for (const key in schema) {
            if (!Object.prototype.hasOwnProperty.call(schema, key)) continue;

            const fieldSchema = schema[key];
            const fieldValue = value[key];

            // Перевірка на обов'язковість
            if (fieldSchema.required && (fieldValue === undefined || fieldValue === null)) {
                const errorMsg = fieldSchema.requiredMessage || getErrorMessage('required', { field: key });
                result.errors.push(errorMsg);
                result.details[key] = { valid: false, error: errorMsg };

                if (firstErrorOnly) break;
                continue;
            }

            // Якщо поле не вказано і воно не обов'язкове, пропускаємо його
            if (fieldValue === undefined) {
                continue;
            }

            // Перевірка типу
            if (fieldSchema.type && typeof fieldValue !== fieldSchema.type) {
                const errorMsg = fieldSchema.typeMessage || getErrorMessage('invalidType', { field: key, expected: fieldSchema.type });
                result.errors.push(errorMsg);
                result.details[key] = { valid: false, error: errorMsg };

                if (firstErrorOnly) break;
                continue;
            }

            // Перевірка користувацької валідації
            if (fieldSchema.validator) {
                let isValid;

                if (typeof fieldSchema.validator === 'function') {
                    isValid = fieldSchema.validator(fieldValue, value);
                } else if (typeof fieldSchema.validator === 'object' && fieldSchema.validator.validate) {
                    isValid = fieldSchema.validator.validate(fieldValue, value);
                } else {
                    isValid = false;
                }

                if (isValid !== true) {
                    const errorMsg = fieldSchema.validatorMessage || getErrorMessage('invalid', { field: key });
                    result.errors.push(errorMsg);
                    result.details[key] = { valid: false, error: errorMsg };

                    if (firstErrorOnly) break;
                    continue;
                }
            }

            // Перевірка мінімальної та максимальної довжини для рядків
            if (fieldSchema.type === 'string') {
                if (fieldSchema.minLength !== undefined && fieldValue.length < fieldSchema.minLength) {
                    const errorMsg = fieldSchema.minLengthMessage || getErrorMessage('tooShort', { field: key, min: fieldSchema.minLength });
                    result.errors.push(errorMsg);
                    result.details[key] = { valid: false, error: errorMsg };

                    if (firstErrorOnly) break;
                    continue;
                }

                if (fieldSchema.maxLength !== undefined && fieldValue.length > fieldSchema.maxLength) {
                    const errorMsg = fieldSchema.maxLengthMessage || getErrorMessage('tooLong', { field: key, max: fieldSchema.maxLength });
                    result.errors.push(errorMsg);
                    result.details[key] = { valid: false, error: errorMsg };

                    if (firstErrorOnly) break;
                    continue;
                }

                // Перевірка патерну для рядків
                if (fieldSchema.pattern) {
                    const patternResult = matchesPattern(fieldValue, fieldSchema.pattern);
                    if (!patternResult.valid) {
                        const errorMsg = fieldSchema.patternMessage || getErrorMessage('patternMismatch', { field: key });
                        result.errors.push(errorMsg);
                        result.details[key] = { valid: false, error: errorMsg };

                        if (firstErrorOnly) break;
                        continue;
                    }
                }
            }

            // Перевірка мінімального та максимального значення для чисел
            if (fieldSchema.type === 'number') {
                if (fieldSchema.min !== undefined && fieldValue < fieldSchema.min) {
                    const errorMsg = fieldSchema.minMessage || getErrorMessage('notInRange', { field: key, min: fieldSchema.min });
                    result.errors.push(errorMsg);
                    result.details[key] = { valid: false, error: errorMsg };

                    if (firstErrorOnly) break;
                    continue;
                }

                if (fieldSchema.max !== undefined && fieldValue > fieldSchema.max) {
                    const errorMsg = fieldSchema.maxMessage || getErrorMessage('notInRange', { field: key, max: fieldSchema.max });
                    result.errors.push(errorMsg);
                    result.details[key] = { valid: false, error: errorMsg };

                    if (firstErrorOnly) break;
                    continue;
                }
            }

            // Перевірка вкладеного об'єкта
            if (fieldSchema.type === 'object' && fieldSchema.schema) {
                const nestedResult = validateObject(fieldValue, fieldSchema.schema, { strictMode, firstErrorOnly });
                if (!nestedResult.valid) {
                    // Додаємо помилки вкладеного об'єкта
                    for (const error of nestedResult.errors) {
                        result.errors.push(`${key}.${error}`);
                    }

                    // Додаємо деталі вкладеного об'єкта
                    for (const nestedKey in nestedResult.details) {
                        result.details[`${key}.${nestedKey}`] = nestedResult.details[nestedKey];
                    }

                    if (firstErrorOnly) break;
                    continue;
                }
            }

            // Перевірка вкладеного масиву
            if (fieldSchema.type === 'array') {
                if (!Array.isArray(fieldValue)) {
                    const errorMsg = getErrorMessage('invalidType', { field: key, expected: 'array' });
                    result.errors.push(errorMsg);
                    result.details[key] = { valid: false, error: errorMsg };

                    if (firstErrorOnly) break;
                    continue;
                }

                // Перевірка довжини масиву
                if (fieldSchema.minLength !== undefined && fieldValue.length < fieldSchema.minLength) {
                    const errorMsg = fieldSchema.minLengthMessage || getErrorMessage('tooShort', { field: key, min: fieldSchema.minLength });
                    result.errors.push(errorMsg);
                    result.details[key] = { valid: false, error: errorMsg };

                    if (firstErrorOnly) break;
                    continue;
                }

                if (fieldSchema.maxLength !== undefined && fieldValue.length > fieldSchema.maxLength) {
                    const errorMsg = fieldSchema.maxLengthMessage || getErrorMessage('tooLong', { field: key, max: fieldSchema.maxLength });
                    result.errors.push(errorMsg);
                    result.details[key] = { valid: false, error: errorMsg };

                    if (firstErrorOnly) break;
                    continue;
                }

                // Перевірка елементів масиву, якщо вказано schema.items
                if (fieldSchema.items) {
                    let hasErrors = false;

                    // Перевіряємо кожен елемент масиву
                    for (let i = 0; i < fieldValue.length; i++) {
                        const item = fieldValue[i];

                        if (typeof fieldSchema.items === 'object' && !Array.isArray(fieldSchema.items)) {
                            // Якщо items - це схема об'єкта
                            if (typeof item === 'object' && item !== null) {
                                const itemResult = validateObject(item, fieldSchema.items, { strictMode, firstErrorOnly });
                                if (!itemResult.valid) {
                                    // Додаємо помилки елемента масиву
                                    for (const error of itemResult.errors) {
                                        result.errors.push(`${key}[${i}].${error}`);
                                    }

                                    // Додаємо деталі елемента масиву
                                    for (const nestedKey in itemResult.details) {
                                        result.details[`${key}[${i}].${nestedKey}`] = itemResult.details[nestedKey];
                                    }

                                    hasErrors = true;
                                    if (firstErrorOnly) break;
                                }
                            } else {
                                const errorMsg = getErrorMessage('invalidType', { field: `${key}[${i}]`, expected: 'object' });
                                result.errors.push(errorMsg);
                                result.details[`${key}[${i}]`] = { valid: false, error: errorMsg };

                                hasErrors = true;
                                if (firstErrorOnly) break;
                            }
                        } else if (typeof fieldSchema.items === 'string') {
                            // Якщо items - це тип
                            if (typeof item !== fieldSchema.items) {
                                const errorMsg = getErrorMessage('invalidType', { field: `${key}[${i}]`, expected: fieldSchema.items });
                                result.errors.push(errorMsg);
                                result.details[`${key}[${i}]`] = { valid: false, error: errorMsg };

                                hasErrors = true;
                                if (firstErrorOnly) break;
                            }
                        } else if (typeof fieldSchema.items === 'function') {
                            // Якщо items - це функція-валідатор
                            const isValid = fieldSchema.items(item, i, fieldValue);
                            if (isValid !== true) {
                                const errorMsg = getErrorMessage('invalid', { field: `${key}[${i}]` });
                                result.errors.push(errorMsg);
                                result.details[`${key}[${i}]`] = { valid: false, error: errorMsg };

                                hasErrors = true;
                                if (firstErrorOnly) break;
                            }
                        }
                    }

                    if (hasErrors && firstErrorOnly) break;
                }
            }

            // Якщо поле пройшло всі перевірки
            result.details[key] = { valid: true, error: null };
        }

        // Перевірка на зайві поля (strictMode)
        if (strictMode) {
            for (const key in value) {
                if (Object.prototype.hasOwnProperty.call(value, key) && !Object.prototype.hasOwnProperty.call(schema, key)) {
                    const errorMsg = getErrorMessage('unknownField', { field: key });
                    result.errors.push(errorMsg);
                    result.details[key] = { valid: false, error: errorMsg };

                    if (firstErrorOnly) break;
                }
            }
        }

        // Встановлюємо результат валідації
        result.valid = result.errors.length === 0;

        return result;
    }

    /**
     * Валідація форми
     * @param {HTMLFormElement} form - Форма для валідації
     * @param {Object} schema - Схема валідації
     * @param {Object} options - Опції валідації
     * @returns {Object} Результат валідації { valid: boolean, errors: Object, values: Object }
     */
    function validateForm(form, schema, options = {}) {
        const {
            trim = config.string.trim,
            liveValidation = false,
            addErrorClass = false,
            errorClass = 'validation-error'
        } = options;

        // Результат валідації
        const result = {
            valid: false,
            errors: {},
            values: {},
            formData: null // FormData для зручності
        };

        // Перевірка, чи form є HTMLFormElement
        if (!(form instanceof HTMLFormElement)) {
            result.errors.form = getErrorMessage('invalidType', { expected: 'HTMLFormElement' });
            return result;
        }

        // Створюємо FormData для зручності
        const formData = new FormData(form);
        result.formData = formData;

        // Збираємо значення форми
        for (const [key, value] of formData.entries()) {
            result.values[key] = value;
        }

        // Валідуємо кожне поле
        for (const key in schema) {
            if (!Object.prototype.hasOwnProperty.call(schema, key)) continue;

            const fieldSchema = schema[key];
            let fieldValue = result.values[key];

            // Обрізаємо пробіли, якщо потрібно
            if (trim && typeof fieldValue === 'string') {
                fieldValue = fieldValue.trim();
                result.values[key] = fieldValue;
            }

            // Перевірка на обов'язковість
            if (fieldSchema.required && (fieldValue === undefined || fieldValue === '' || fieldValue === null)) {
                result.errors[key] = fieldSchema.requiredMessage || getErrorMessage('required', { field: key });

                if (addErrorClass) {
                    const fieldElement = form.elements[key];
                    if (fieldElement) {
                        fieldElement.classList.add(errorClass);
                    }
                }

                continue;
            }

            // Якщо поле не вказано і воно не обов'язкове, пропускаємо його
            if (fieldValue === undefined || fieldValue === '') {
                continue;
            }

            // Перевірка на патерн для рядків
            if (fieldSchema.pattern && typeof fieldValue === 'string') {
                const regex = new RegExp(fieldSchema.pattern);
                if (!regex.test(fieldValue)) {
                    result.errors[key] = fieldSchema.patternMessage || getErrorMessage('patternMismatch', { field: key });

                    if (addErrorClass) {
                        const fieldElement = form.elements[key];
                        if (fieldElement) {
                            fieldElement.classList.add(errorClass);
                        }
                    }

                    continue;
                }
            }

            // Перевірка на мінімальну та максимальну довжину
            if (fieldSchema.minLength !== undefined && typeof fieldValue === 'string' && fieldValue.length < fieldSchema.minLength) {
                result.errors[key] = fieldSchema.minLengthMessage || getErrorMessage('tooShort', { field: key, min: fieldSchema.minLength });

                if (addErrorClass) {
                    const fieldElement = form.elements[key];
                    if (fieldElement) {
                        fieldElement.classList.add(errorClass);
                    }
                }

                continue;
            }

            if (fieldSchema.maxLength !== undefined && typeof fieldValue === 'string' && fieldValue.length > fieldSchema.maxLength) {
                result.errors[key] = fieldSchema.maxLengthMessage || getErrorMessage('tooLong', { field: key, max: fieldSchema.maxLength });

                if (addErrorClass) {
                    const fieldElement = form.elements[key];
                    if (fieldElement) {
                        fieldElement.classList.add(errorClass);
                    }
                }

                continue;
            }

            // Перевірка на мінімальне та максимальне значення
            if (fieldSchema.min !== undefined) {
                const numValue = parseFloat(fieldValue);
                if (isNaN(numValue) || numValue < fieldSchema.min) {
                    result.errors[key] = fieldSchema.minMessage || getErrorMessage('notInRange', { field: key, min: fieldSchema.min });

                    if (addErrorClass) {
                        const fieldElement = form.elements[key];
                        if (fieldElement) {
                            fieldElement.classList.add(errorClass);
                        }
                    }

                    continue;
                }
            }

            if (fieldSchema.max !== undefined) {
                const numValue = parseFloat(fieldValue);
                if (isNaN(numValue) || numValue > fieldSchema.max) {
                    result.errors[key] = fieldSchema.maxMessage || getErrorMessage('notInRange', { field: key, max: fieldSchema.max });

                    if (addErrorClass) {
                        const fieldElement = form.elements[key];
                        if (fieldElement) {
                            fieldElement.classList.add(errorClass);
                        }
                    }

                    continue;
                }
            }

            // Перевірка електронної пошти
            if (fieldSchema.isEmail && typeof fieldValue === 'string') {
                const emailResult = isEmail(fieldValue);
                if (!emailResult.valid) {
                    result.errors[key] = fieldSchema.emailMessage || getErrorMessage('notEmail');

                    if (addErrorClass) {
                        const fieldElement = form.elements[key];
                        if (fieldElement) {
                            fieldElement.classList.add(errorClass);
                        }
                    }

                    continue;
                }
            }

            // Перевірка URL
            if (fieldSchema.isUrl && typeof fieldValue === 'string') {
                const urlResult = isUrl(fieldValue, fieldSchema.urlOptions || {});
                if (!urlResult.valid) {
                    result.errors[key] = fieldSchema.urlMessage || getErrorMessage('notUrl');

                    if (addErrorClass) {
                        const fieldElement = form.elements[key];
                        if (fieldElement) {
                            fieldElement.classList.add(errorClass);
                        }
                    }

                    continue;
                }
            }

            // Перевірка телефону
            if (fieldSchema.isPhone && typeof fieldValue === 'string') {
                const phoneResult = isPhone(fieldValue, fieldSchema.phoneOptions || {});
                if (!phoneResult.valid) {
                    result.errors[key] = fieldSchema.phoneMessage || getErrorMessage('notPhone');

                    if (addErrorClass) {
                        const fieldElement = form.elements[key];
                        if (fieldElement) {
                            fieldElement.classList.add(errorClass);
                        }
                    }

                    continue;
                }
            }

            // Перевірка дати
            if (fieldSchema.isDate && (typeof fieldValue === 'string' || fieldValue instanceof Date)) {
                const dateResult = isDate(fieldValue, fieldSchema.dateOptions || {});
                if (!dateResult.valid) {
                    result.errors[key] = fieldSchema.dateMessage || getErrorMessage('notDate');

                    if (addErrorClass) {
                        const fieldElement = form.elements[key];
                        if (fieldElement) {
                            fieldElement.classList.add(errorClass);
                        }
                    }

                    continue;
                }
            }

            // Користувацька валідація
            if (fieldSchema.validator && typeof fieldSchema.validator === 'function') {
                const validatorResult = fieldSchema.validator(fieldValue, result.values);
                if (validatorResult !== true) {
                    result.errors[key] = fieldSchema.validatorMessage || validatorResult || getErrorMessage('invalid', { field: key });

                    if (addErrorClass) {
                        const fieldElement = form.elements[key];
                        if (fieldElement) {
                            fieldElement.classList.add(errorClass);
                        }
                    }

                    continue;
                }
            }

            // Якщо поле проходить валідацію і був доданий клас помилки, видаляємо його
            if (addErrorClass) {
                const fieldElement = form.elements[key];
                if (fieldElement) {
                    fieldElement.classList.remove(errorClass);
                }
            }
        }

        // Встановлюємо результат валідації
        result.valid = Object.keys(result.errors).length === 0;

        // Налаштування живої валідації, якщо потрібно
        if (liveValidation && !result.valid) {
            setupLiveValidation(form, schema, options);
        }

        return result;
    }

    /**
     * Налаштування живої валідації для форми
     * @param {HTMLFormElement} form - Форма для валідації
     * @param {Object} schema - Схема валідації
     * @param {Object} options - Опції валідації
     */
    function setupLiveValidation(form, schema, options) {
        const {
            errorClass = 'validation-error',
            errorMessageClass = 'validation-error-message',
            appendErrorMessages = false
        } = options;

        // Додаємо обробники подій для полів форми
        for (const key in schema) {
            if (!Object.prototype.hasOwnProperty.call(schema, key)) continue;

            const fieldElement = form.elements[key];
            if (!fieldElement) continue;

            // Додаємо обробник події для поля
            const eventType = getFieldEventType(fieldElement);

            // Прибираємо існуючий обробник, щоб уникнути дублювання
            fieldElement.removeEventListener(eventType, fieldValidationHandler);

            // Додаємо новий обробник
            fieldElement.addEventListener(eventType, fieldValidationHandler);

            // Функція-обробник для поля
            function fieldValidationHandler() {
                const fieldValue = fieldElement.value;
                const fieldSchema = schema[key];

                // Видаляємо попереднє повідомлення про помилку
                removeErrorMessage(fieldElement);

                // Валідуємо поле
                const isValid = validateField(fieldValue, fieldSchema, form);

                if (!isValid.valid) {
                    // Додаємо клас помилки
                    fieldElement.classList.add(errorClass);

                    // Додаємо повідомлення про помилку, якщо потрібно
                    if (appendErrorMessages) {
                        addErrorMessage(fieldElement, isValid.error, errorMessageClass);
                    }
                } else {
                    // Видаляємо клас помилки
                    fieldElement.classList.remove(errorClass);
                }
            }
        }

        /**
         * Валідація окремого поля
         * @param {string} value - Значення поля
         * @param {Object} fieldSchema - Схема валідації поля
         * @param {HTMLFormElement} form - Форма
         * @returns {Object} Результат валідації
         */
        function validateField(value, fieldSchema, form) {
            const result = {
                valid: true,
                error: null
            };

            // Обрізаємо пробіли, якщо потрібно
            if (options.trim && typeof value === 'string') {
                value = value.trim();
            }

            // Перевірка на обов'язковість
            if (fieldSchema.required && (value === undefined || value === '' || value === null)) {
                result.valid = false;
                result.error = fieldSchema.requiredMessage || getErrorMessage('required');
                return result;
            }

            // Якщо поле не вказано і воно не обов'язкове, пропускаємо його
            if (value === undefined || value === '') {
                return result;
            }

            // Перевірка на патерн для рядків
            if (fieldSchema.pattern && typeof value === 'string') {
                const regex = new RegExp(fieldSchema.pattern);
                if (!regex.test(value)) {
                    result.valid = false;
                    result.error = fieldSchema.patternMessage || getErrorMessage('patternMismatch');
                    return result;
                }
            }

            // Перевірка на мінімальну та максимальну довжину
            if (fieldSchema.minLength !== undefined && typeof value === 'string' && value.length < fieldSchema.minLength) {
                result.valid = false;
                result.error = fieldSchema.minLengthMessage || getErrorMessage('tooShort', { min: fieldSchema.minLength });
                return result;
            }

            if (fieldSchema.maxLength !== undefined && typeof value === 'string' && value.length > fieldSchema.maxLength) {
                result.valid = false;
                result.error = fieldSchema.maxLengthMessage || getErrorMessage('tooLong', { max: fieldSchema.maxLength });
                return result;
            }

            // Перевірка на мінімальне та максимальне значення
            if (fieldSchema.min !== undefined) {
                const numValue = parseFloat(value);
                if (isNaN(numValue) || numValue < fieldSchema.min) {
                    result.valid = false;
                    result.error = fieldSchema.minMessage || getErrorMessage('notInRange', { min: fieldSchema.min });
                    return result;
                }
            }

            if (fieldSchema.max !== undefined) {
                const numValue = parseFloat(value);
                if (isNaN(numValue) || numValue > fieldSchema.max) {
                    result.valid = false;
                    result.error = fieldSchema.maxMessage || getErrorMessage('notInRange', { max: fieldSchema.max });
                    return result;
                }
            }

            // Перевірка електронної пошти
            if (fieldSchema.isEmail && typeof value === 'string') {
                const emailResult = isEmail(value);
                if (!emailResult.valid) {
                    result.valid = false;
                    result.error = fieldSchema.emailMessage || getErrorMessage('notEmail');
                    return result;
                }
            }

            // Перевірка URL
            if (fieldSchema.isUrl && typeof value === 'string') {
                const urlResult = isUrl(value, fieldSchema.urlOptions || {});
                if (!urlResult.valid) {
                    result.valid = false;
                    result.error = fieldSchema.urlMessage || getErrorMessage('notUrl');
                    return result;
                }
            }

            // Перевірка телефону
            if (fieldSchema.isPhone && typeof value === 'string') {
                const phoneResult = isPhone(value, fieldSchema.phoneOptions || {});
                if (!phoneResult.valid) {
                    result.valid = false;
                    result.error = fieldSchema.phoneMessage || getErrorMessage('notPhone');
                    return result;
                }
            }

            // Користувацька валідація
            if (fieldSchema.validator && typeof fieldSchema.validator === 'function') {
                const formValues = {};
                const formData = new FormData(form);

                // Збираємо значення форми
                for (const [key, value] of formData.entries()) {
                    formValues[key] = value;
                }

                const validatorResult = fieldSchema.validator(value, formValues);
                if (validatorResult !== true) {
                    result.valid = false;
                    result.error = fieldSchema.validatorMessage || validatorResult || getErrorMessage('invalid');
                    return result;
                }
            }

            return result;
        }

        /**
         * Додавання повідомлення про помилку
         * @param {HTMLElement} element - Елемент поля
         * @param {string} message - Повідомлення про помилку
         * @param {string} errorClass - Клас для повідомлення про помилку
         */
        function addErrorMessage(element, message, errorClass) {
            // Створюємо елемент для повідомлення про помилку
            const errorElement = document.createElement('div');
            errorElement.className = errorClass;
            errorElement.textContent = message;
            errorElement.setAttribute('data-validation-error', 'true');

            // Додаємо після елемента
            if (element.nextSibling) {
                element.parentNode.insertBefore(errorElement, element.nextSibling);
            } else {
                element.parentNode.appendChild(errorElement);
            }
        }

        /**
         * Видалення повідомлення про помилку
         * @param {HTMLElement} element - Елемент поля
         */
        function removeErrorMessage(element) {
            // Шукаємо наступний елемент
            let nextElement = element.nextSibling;
            while (nextElement) {
                if (nextElement.nodeType === 1 && nextElement.getAttribute('data-validation-error') === 'true') {
                    nextElement.parentNode.removeChild(nextElement);
                    break;
                }
                nextElement = nextElement.nextSibling;
            }
        }

        /**
         * Отримання типу події для поля
         * @param {HTMLElement} element - Елемент поля
         * @returns {string} Тип події
         */
        function getFieldEventType(element) {
            const tagName = element.tagName.toLowerCase();
            const type = element.type && element.type.toLowerCase();

            if (tagName === 'select' || type === 'checkbox' || type === 'radio') {
                return 'change';
            }

            return 'input';
        }
    }

    /**
     * Валідація значення за допомогою ланцюжка валідаторів
     * @param {*} value - Значення для валідації
     * @returns {Object} Об'єкт з методами валідації
     */
    function validate(value) {
        // Об'єкт для ланцюжка валідацій
        const chain = {
            _value: value,
            _valid: true,
            _errors: [],

            // Перевірка, чи валідація пройшла успішно
            isValid() {
                return this._valid;
            },

            // Отримання помилок
            getErrors() {
                return this._errors;
            },

            // Отримання першої помилки
            getFirstError() {
                return this._errors.length > 0 ? this._errors[0] : null;
            },

            // Отримання значення
            getValue() {
                return this._value;
            },

            // Додавання помилки
            _addError(error) {
                this._valid = false;
                this._errors.push(error);
                return this;
            },

            // Перевірка на порожнє значення
            notEmpty(message) {
                if (this._valid && isEmpty(this._value)) {
                    this._addError(message || getErrorMessage('empty'));
                }
                return this;
            },

            // Перевірка на число
            isNumber(options, message) {
                if (this._valid) {
                    const result = isNumber(this._value, options);
                    if (!result.valid) {
                        this._addError(message || result.error);
                    }
                }
                return this;
            },

            // Перевірка на ціле число
            isInteger(options, message) {
                if (this._valid) {
                    const result = isInteger(this._value, options);
                    if (!result.valid) {
                        this._addError(message || result.error);
                    }
                }
                return this;
            },

            // Перевірка на число з плаваючою комою
            isFloat(options, message) {
                if (this._valid) {
                    const result = isFloat(this._value, options);
                    if (!result.valid) {
                        this._addError(message || result.error);
                    }
                }
                return this;
            },

            // Перевірка на email
            isEmail(options, message) {
                if (this._valid) {
                    const result = isEmail(this._value, options);
                    if (!result.valid) {
                        this._addError(message || result.error);
                    }
                }
                return this;
            },

            // Перевірка на URL
            isUrl(options, message) {
                if (this._valid) {
                    const result = isUrl(this._value, options);
                    if (!result.valid) {
                        this._addError(message || result.error);
                    }
                }
                return this;
            },

            // Перевірка на телефон
            isPhone(options, message) {
                if (this._valid) {
                    const result = isPhone(this._value, options);
                    if (!result.valid) {
                        this._addError(message || result.error);
                    }
                }
                return this;
            },

            // Перевірка на дату
            isDate(options, message) {
                if (this._valid) {
                    const result = isDate(this._value, options);
                    if (!result.valid) {
                        this._addError(message || result.error);
                    }
                }
                return this;
            },

            // Перевірка на UUID
            isUuid(options, message) {
                if (this._valid) {
                    const result = isUuid(this._value, options);
                    if (!result.valid) {
                        this._addError(message || result.error);
                    }
                }
                return this;
            },

            // Перевірка на входження в список дозволених значень
            isOneOf(allowedValues, options, message) {
                if (this._valid) {
                    const result = isOneOf(this._value, allowedValues, options);
                    if (!result.valid) {
                        this._addError(message || result.error);
                    }
                }
                return this;
            },

            // Перевірка на відповідність регулярному виразу
            matchesPattern(pattern, options, message) {
                if (this._valid) {
                    const result = matchesPattern(this._value, pattern, options);
                    if (!result.valid) {
                        this._addError(message || result.error);
                    }
                }
                return this;
            },

            // Перевірка довжини рядка
            hasLength(options, message) {
                if (this._valid) {
                    const result = hasLength(this._value, options);
                    if (!result.valid) {
                        this._addError(message || result.error);
                    }
                }
                return this;
            },

            // Перевірка на мінімальну довжину
            minLength(min, message) {
                return this.hasLength({ min }, message);
            },

            // Перевірка на максимальну довжину
            maxLength(max, message) {
                return this.hasLength({ max }, message);
            },

            // Перевірка на точну довжину
            exactLength(exact, message) {
                return this.hasLength({ exact }, message);
            },

            // Перевірка на мінімальне значення
            min(min, message) {
                if (this._valid) {
                    if (typeof this._value === 'string') {
                        const num = parseFloat(this._value);
                        if (isNaN(num) || num < min) {
                            this._addError(message || getErrorMessage('notInRange', { min }));
                        }
                    } else if (typeof this._value === 'number') {
                        if (this._value < min) {
                            this._addError(message || getErrorMessage('notInRange', { min }));
                        }
                    }
                }
                return this;
            },

            // Перевірка на максимальне значення
            max(max, message) {
                if (this._valid) {
                    if (typeof this._value === 'string') {
                        const num = parseFloat(this._value);
                        if (isNaN(num) || num > max) {
                            this._addError(message || getErrorMessage('notInRange', { max }));
                        }
                    } else if (typeof this._value === 'number') {
                        if (this._value > max) {
                            this._addError(message || getErrorMessage('notInRange', { max }));
                        }
                    }
                }
                return this;
            },

            // Користувацька валідація
            custom(validator, message) {
                if (this._valid) {
                    const result = validator(this._value);
                    if (result !== true) {
                        this._addError(message || (typeof result === 'string' ? result : getErrorMessage('invalid')));
                    }
                }
                return this;
            }
        };

        return chain;
    }

    // Ініціалізація модуля
    function init() {
        // Визначаємо мову браузера
        try {
            const browserLocale = navigator.language;

            // Якщо мова браузера підтримується
            if (browserLocale.startsWith('uk') && config.errorMessages['uk-UA']) {
                config.locale = 'uk-UA';
            } else if (browserLocale.startsWith('en') && config.errorMessages['en-US']) {
                config.locale = 'en-US';
            }
        } catch (e) {
            console.warn('Не вдалося визначити мову браузера:', e);
        }

        // Пробуємо отримати мову з localStorage
        try {
            if (window.StorageUtils) {
                const storedLocale = window.StorageUtils.getItem('language');
                if (storedLocale && config.errorMessages[storedLocale]) {
                    config.locale = storedLocale;
                }
            } else if (localStorage) {
                const storedLocale = localStorage.getItem('language') || localStorage.getItem('winix_language');
                if (storedLocale && config.errorMessages[storedLocale]) {
                    config.locale = storedLocale;
                }
            }
        } catch (e) {
            console.warn('Не вдалося отримати мову з localStorage:', e);
        }

        // Підписуємося на подію зміни мови
        document.addEventListener('language-changed', function(event) {
            if (event.detail && event.detail.language && config.errorMessages[event.detail.language]) {
                setLocale(event.detail.language);
            }
        });

        return true;
    }

    // Запускаємо ініціалізацію
    init();

    // Публічний API
    return {
        // Прості валідатори
        isEmpty,
        isNumber,
        isInteger,
        isFloat,
        isEmail,
        isUrl,
        isPhone,
        isDate,
        isUuid,
        isJson,
        isTelegramId,
        isOneOf,
        matchesPattern,
        hasLength,

        // Складні валідатори
        validateObject,
        validateForm,
        validate,

        // Налаштування
        getConfig: () => JSON.parse(JSON.stringify(config)),
        updateConfig,
        resetConfig,

        // Локалізація
        setLocale,
        getCurrentLocale,
        addLocaleMessages,
        getErrorMessage,

        // Утиліти для роботи з кешем
        clearValidationCache
    };
})();