/**
 * Validators - утиліти для валідації різних типів даних
 * Відповідає за:
 * - Перевірку коректності різних форматів даних
 * - Валідацію форм та введених користувачем даних
 * - Перевірку параметрів для запитів API
 */

window.Validators = (function() {
    /**
     * Перевірка на порожнє значення
     * @param {*} value - Значення для перевірки
     * @returns {boolean} Результат перевірки
     */
    function isEmpty(value) {
        if (value === null || value === undefined) {
            return true;
        }

        if (typeof value === 'string') {
            return value.trim() === '';
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
     * @returns {boolean} Результат перевірки
     */
    function isNumber(value, options = {}) {
        const {
            allowString = true,
            allowInfinity = false,
            allowNaN = false
        } = options;

        // Перевірка на null та undefined
        if (value === null || value === undefined) {
            return false;
        }

        // Конвертуємо рядок в число, якщо дозволено
        let number = value;
        if (allowString && typeof value === 'string') {
            number = Number(value);
        }

        // Перевірка, чи значення є числом
        if (typeof number !== 'number') {
            return false;
        }

        // Перевірка на NaN
        if (!allowNaN && isNaN(number)) {
            return false;
        }

        // Перевірка на Infinity
        if (!allowInfinity && !isFinite(number)) {
            return false;
        }

        return true;
    }

    /**
     * Перевірка, чи значення є цілим числом
     * @param {*} value - Значення для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {boolean} Результат перевірки
     */
    function isInteger(value, options = {}) {
        const {
            allowString = true,
            min = Number.MIN_SAFE_INTEGER,
            max = Number.MAX_SAFE_INTEGER
        } = options;

        // Перевірка, чи значення є числом
        if (!isNumber(value, { allowString, allowInfinity: false, allowNaN: false })) {
            return false;
        }

        // Конвертуємо рядок в число, якщо потрібно
        let number = value;
        if (allowString && typeof value === 'string') {
            number = Number(value);
        }

        // Перевірка, чи число є цілим
        if (!Number.isInteger(number)) {
            return false;
        }

        // Перевірка діапазону
        return number >= min && number <= max;
    }

    /**
     * Перевірка, чи значення є дійсним числом
     * @param {*} value - Значення для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {boolean} Результат перевірки
     */
    function isFloat(value, options = {}) {
        const {
            allowString = true,
            min = -Number.MAX_VALUE,
            max = Number.MAX_VALUE,
            decimals = null // Максимальна кількість знаків після коми
        } = options;

        // Перевірка, чи значення є числом
        if (!isNumber(value, { allowString, allowInfinity: false, allowNaN: false })) {
            return false;
        }

        // Конвертуємо рядок в число, якщо потрібно
        let number = value;
        if (allowString && typeof value === 'string') {
            number = Number(value);
        }

        // Перевірка діапазону
        if (number < min || number > max) {
            return false;
        }

        // Перевірка кількості знаків після коми
        if (decimals !== null) {
            const decimalPlaces = getDecimalPlaces(number);
            return decimalPlaces <= decimals;
        }

        return true;
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
     * @returns {boolean} Результат перевірки
     */
    function isEmail(email) {
        if (typeof email !== 'string') {
            return false;
        }

        // RFC 5322 сумісний вираз
        const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return emailRegex.test(email.trim());
    }

    /**
     * Перевірка на валідний URL
     * @param {string} url - URL для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {boolean} Результат перевірки
     */
    function isUrl(url, options = {}) {
        const {
            requireProtocol = true,
            allowedProtocols = ['http:', 'https:'],
            allowRelative = false
        } = options;

        if (typeof url !== 'string') {
            return false;
        }

        // Для відносних URL
        if (allowRelative && url.startsWith('/')) {
            return /^\/[^\/]/.test(url);
        }

        try {
            const urlObj = new URL(url);

            // Перевірка протоколу
            if (requireProtocol && !allowedProtocols.includes(urlObj.protocol)) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Перевірка на валідний телефонний номер
     * @param {string} phone - Телефонний номер для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {boolean} Результат перевірки
     */
    function isPhone(phone, options = {}) {
        const {
            requireCountryCode = false,
            format = 'any', // 'any', 'international', 'local'
            countryCode = '+38' // Для України
        } = options;

        if (typeof phone !== 'string') {
            return false;
        }

        // Видаляємо всі нецифрові символи
        const digitsOnly = phone.replace(/\D/g, '');

        // Українські номери повинні бути довжиною 12 цифр з кодом країни або 10 без нього
        switch (format) {
            case 'international':
                // Для міжнародного формату
                if (requireCountryCode) {
                    // Починається з коду країни (напр. 380 для України)
                    return digitsOnly.length === 12 && digitsOnly.startsWith('380');
                } else {
                    // Може бути з кодом країни або без
                    return digitsOnly.length === 12 && digitsOnly.startsWith('380') ||
                           digitsOnly.length === 10 && digitsOnly.startsWith('0');
                }

            case 'local':
                // Тільки локальний формат
                return digitsOnly.length === 10 && digitsOnly.startsWith('0');

            case 'any':
            default:
                // Будь-який формат
                return (digitsOnly.length === 12 && digitsOnly.startsWith('380')) ||
                       (digitsOnly.length === 10 && digitsOnly.startsWith('0'));
        }
    }

    /**
     * Перевірка на валідну дату
     * @param {*} date - Дата для перевірки
     * @param {Object} options - Опції перевірки
     * @returns {boolean} Результат перевірки
     */
    function isDate(date, options = {}) {
        const {
            allowString = true,
            minDate = null,
            maxDate = null,
            format = null // Для перевірки рядкового формату (наприклад, 'dd.MM.yyyy')
        } = options;

        // Перевірка, чи об'єкт є датою
        if (date instanceof Date) {
            return !isNaN(date.getTime()) && isDateInRange(date, minDate, maxDate);
        }

        // Перевірка рядка
        if (allowString && typeof date === 'string') {
            // Якщо вказано формат, перевіряємо його
            if (format) {
                return isValidDateFormat(date, format) && isDateInRange(parseDate(date, format), minDate, maxDate);
            }

            // Спроба перетворити рядок у дату за замовчуванням
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
                return isDateInRange(parsedDate, minDate, maxDate);
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
                    return isDateInRange(dateObj, minDate, maxDate);
                }
            }
        }

        return false;
    }

    /**
     * Перевірка, чи дата входить в діапазон
     * @param {Date} date - Дата для перевірки
     * @param {Date|null} minDate - Мінімальна дата
     * @param {Date|null} maxDate - Максимальна дата
     * @returns {boolean} Результат перевірки
     */
    function isDateInRange(date, minDate, maxDate) {
        if (!date || isNaN(date.getTime())) {
            return false;
        }

        if (minDate && date < new Date(minDate)) {
            return false;
        }

        if (maxDate && date > new Date(maxDate)) {
            return false;
        }

        return true;
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
     * @returns {boolean} Результат перевірки
     */
    function isUuid(uuid) {
        if (typeof uuid !== 'string') {
            return false;
        }

        // Підтримка різних форматів UUID
        const patterns = {
            standard: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
            noHyphens: /^[0-9a-f]{32}$/i,
            braced: /^\{[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\}$/i
        };

        return patterns.standard.test(uuid) ||
               patterns.noHyphens.test(uuid) ||
               patterns.braced.test(uuid);
    }

    /**
     * Перевірка, чи рядок є JSON
     * @param {string} json - Рядок для перевірки
     * @returns {boolean} Результат перевірки
     */
    function isJson(json) {
        if (typeof json !== 'string') {
            return false;
        }

        try {
            const obj = JSON.parse(json);
            return !!obj && typeof obj === 'object';
        } catch (error) {
            return false;
        }
    }

    /**
     * Перевірка на валідний ID Telegram
     * @param {string|number} id - ID для перевірки
     * @returns {boolean} Результат перевірки
     */
    function isTelegramId(id) {
        // Конвертуємо в рядок
        const idStr = String(id);

        // Telegram ID - це:
        // 1. Цифрове значення
        // 2. Довжина 7-12 цифр (зараз до 10, але для майбутньої сумісності)
        return /^[0-9]{7,12}$/.test(idStr);
    }

    /**
     * Перевірка, чи значення входить у список дозволених значень
     * @param {*} value - Значення для перевірки
     * @param {Array} allowedValues - Список дозволених значень
     * @returns {boolean} Результат перевірки
     */
    function isOneOf(value, allowedValues) {
        if (!Array.isArray(allowedValues)) {
            return false;
        }

        return allowedValues.includes(value);
    }

    /**
     * Перевірка, чи значення є об'єктом, що задовольняє схему
     * @param {*} value - Значення для перевірки
     * @param {Object} schema - Схема об'єкта
     * @returns {Object} Результат перевірки { valid: boolean, errors: Array }
     */
    function validateObject(value, schema) {
        if (typeof value !== 'object' || value === null) {
            return { valid: false, errors: ['Value is not an object'] };
        }

        const errors = [];

        // Перевіряємо кожне поле схеми
        for (const key in schema) {
            const fieldSchema = schema[key];
            const fieldValue = value[key];

            // Перевірка на обов'язковість
            if (fieldSchema.required && (fieldValue === undefined || fieldValue === null)) {
                errors.push(`Field "${key}" is required`);
                continue;
            }

            // Якщо поле не вказано і воно не обов'язкове, пропускаємо його
            if (fieldValue === undefined) {
                continue;
            }

            // Перевірка типу
            if (fieldSchema.type && typeof fieldValue !== fieldSchema.type) {
                errors.push(`Field "${key}" should be of type ${fieldSchema.type}`);
                continue;
            }

            // Додаткові перевірки
            if (fieldSchema.validator) {
                const isValid = fieldSchema.validator(fieldValue);
                if (!isValid) {
                    errors.push(`Field "${key}" failed validation`);
                }
            }

            // Перевірка мінімальної та максимальної довжини для рядків
            if (fieldSchema.type === 'string') {
                if (fieldSchema.minLength !== undefined && fieldValue.length < fieldSchema.minLength) {
                    errors.push(`Field "${key}" should have a minimum length of ${fieldSchema.minLength}`);
                }

                if (fieldSchema.maxLength !== undefined && fieldValue.length > fieldSchema.maxLength) {
                    errors.push(`Field "${key}" should have a maximum length of ${fieldSchema.maxLength}`);
                }
            }

            // Перевірка мінімального та максимального значення для чисел
            if (fieldSchema.type === 'number') {
                if (fieldSchema.min !== undefined && fieldValue < fieldSchema.min) {
                    errors.push(`Field "${key}" should be at least ${fieldSchema.min}`);
                }

                if (fieldSchema.max !== undefined && fieldValue > fieldSchema.max) {
                    errors.push(`Field "${key}" should be at most ${fieldSchema.max}`);
                }
            }

            // Перевірка вкладеного об'єкта
            if (fieldSchema.type === 'object' && fieldSchema.schema) {
                const nestedResult = validateObject(fieldValue, fieldSchema.schema);
                if (!nestedResult.valid) {
                    errors.push(...nestedResult.errors.map(err => `${key}.${err}`));
                }
            }

            // Перевірка вкладеного масиву
            if (fieldSchema.type === 'array' && fieldSchema.items) {
                if (!Array.isArray(fieldValue)) {
                    errors.push(`Field "${key}" should be an array`);
                } else {
                    // Перевіряємо кожен елемент масиву
                    fieldValue.forEach((item, index) => {
                        if (typeof fieldSchema.items === 'object') {
                            // Якщо items - це схема об'єкта
                            if (typeof item === 'object') {
                                const itemResult = validateObject(item, fieldSchema.items);
                                if (!itemResult.valid) {
                                    errors.push(...itemResult.errors.map(err => `${key}[${index}].${err}`));
                                }
                            } else {
                                errors.push(`${key}[${index}] should be an object`);
                            }
                        } else if (typeof fieldSchema.items === 'string') {
                            // Якщо items - це тип
                            if (typeof item !== fieldSchema.items) {
                                errors.push(`${key}[${index}] should be of type ${fieldSchema.items}`);
                            }
                        }
                    });
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валідація форми
     * @param {HTMLFormElement} form - Форма для валідації
     * @param {Object} schema - Схема валідації
     * @returns {Object} Результат валідації { valid: boolean, errors: Object, values: Object }
     */
    function validateForm(form, schema) {
        if (!(form instanceof HTMLFormElement)) {
            return { valid: false, errors: { form: 'Not a form element' }, values: {} };
        }

        const formData = new FormData(form);
        const values = {};
        const errors = {};

        // Збираємо значення форми
        for (const [key, value] of formData.entries()) {
            values[key] = value;
        }

        // Валідуємо кожне поле
        for (const key in schema) {
            const fieldSchema = schema[key];
            const fieldValue = values[key];

            // Перевірка на обов'язковість
            if (fieldSchema.required && (fieldValue === undefined || fieldValue === '')) {
                errors[key] = fieldSchema.requiredMessage || `Поле "${key}" обов'язкове`;
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
                    errors[key] = fieldSchema.patternMessage || `Поле "${key}" не відповідає формату`;
                    continue;
                }
            }

            // Перевірка на мінімальну та максимальну довжину
            if (fieldSchema.minLength !== undefined && fieldValue.length < fieldSchema.minLength) {
                errors[key] = fieldSchema.minLengthMessage || `Мінімальна довжина поля "${key}" - ${fieldSchema.minLength}`;
                continue;
            }

            if (fieldSchema.maxLength !== undefined && fieldValue.length > fieldSchema.maxLength) {
                errors[key] = fieldSchema.maxLengthMessage || `Максимальна довжина поля "${key}" - ${fieldSchema.maxLength}`;
                continue;
            }

            // Перевірка на мінімальне та максимальне значення
            if (fieldSchema.min !== undefined) {
                const numValue = parseFloat(fieldValue);
                if (isNaN(numValue) || numValue < fieldSchema.min) {
                    errors[key] = fieldSchema.minMessage || `Мінімальне значення поля "${key}" - ${fieldSchema.min}`;
                    continue;
                }
            }

            if (fieldSchema.max !== undefined) {
                const numValue = parseFloat(fieldValue);
                if (isNaN(numValue) || numValue > fieldSchema.max) {
                    errors[key] = fieldSchema.maxMessage || `Максимальне значення поля "${key}" - ${fieldSchema.max}`;
                    continue;
                }
            }

            // Перевірка електронної пошти
            if (fieldSchema.isEmail && !isEmail(fieldValue)) {
                errors[key] = fieldSchema.emailMessage || 'Некоректний формат електронної пошти';
                continue;
            }

            // Перевірка URL
            if (fieldSchema.isUrl && !isUrl(fieldValue, fieldSchema.urlOptions || {})) {
                errors[key] = fieldSchema.urlMessage || 'Некоректний URL';
                continue;
            }

            // Перевірка телефону
            if (fieldSchema.isPhone && !isPhone(fieldValue, fieldSchema.phoneOptions || {})) {
                errors[key] = fieldSchema.phoneMessage || 'Некоректний номер телефону';
                continue;
            }

            // Користувацька валідація
            if (fieldSchema.validator && typeof fieldSchema.validator === 'function') {
                const validatorResult = fieldSchema.validator(fieldValue, values);
                if (validatorResult !== true) {
                    errors[key] = validatorResult || `Поле "${key}" не пройшло валідацію`;
                    continue;
                }
            }
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors: errors,
            values: values
        };
    }

    // Публічний API
    return {
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
        validateObject,
        validateForm
    };
})();