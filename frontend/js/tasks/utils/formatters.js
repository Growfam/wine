/**
 * Formatters - оптимізовані утиліти для форматування різних типів даних
 * Відповідає за:
 * - Форматування чисел, дат, валют з урахуванням локалізації
 * - Узгоджене перетворення даних у людинозрозумілий формат
 * - Інтелектуальне форматування тексту для відображення
 * - Централізоване керування форматуванням у всій системі
 */

window.Formatters = (function() {
    // Налаштування за замовчуванням
    const DEFAULT_CONFIG = {
        // Локаль за замовчуванням
        locale: 'uk-UA',

        // Налаштування чисел
        number: {
            decimals: 2,
            decimalSeparator: '.',
            thousandsSeparator: ' ',
            padDecimals: false,
            roundingMode: 'round' // 'round', 'floor', 'ceil'
        },

        // Налаштування валют
        currency: {
            decimals: 2,
            useSymbol: true,
            symbolPosition: 'after', // 'before', 'after'
            defaultCurrency: 'UAH'
        },

        // Налаштування відсотків
        percent: {
            decimals: 1,
            includeSymbol: true,
            padDecimals: false
        },

        // Налаштування дат
        date: {
            format: 'dd.MM.yyyy',
            timeFormat: 'HH:mm',
            dateTimeFormat: 'dd.MM.yyyy HH:mm'
        },

        // Налаштування тексту
        text: {
            maxLength: 0, // 0 - без обмежень
            ellipsis: '...',
            preserveWords: true,
            preserveLines: true,
            escapeHtml: true
        }
    };

    // Поточна конфігурація
    let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // Кеш форматерів
    const formattersCache = {};

    // Локалізовані назви для різних мов
    const locales = {
        'uk-UA': {
            months: ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'],
            monthsShort: ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'],
            days: ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'п\'ятниця', 'субота'],
            daysShort: ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
            timeUnits: {
                second: ['секунда', 'секунди', 'секунд'],
                minute: ['хвилина', 'хвилини', 'хвилин'],
                hour: ['година', 'години', 'годин'],
                day: ['день', 'дні', 'днів'],
                week: ['тиждень', 'тижні', 'тижнів'],
                month: ['місяць', 'місяці', 'місяців'],
                year: ['рік', 'роки', 'років']
            },
            currencySymbols: {
                'UAH': '₴',
                'USD': '$',
                'EUR': '€',
                'GBP': '£',
                'JPY': '¥',
                'WINIX': '$WINIX'
            }
        },
        'en-US': {
            months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            timeUnits: {
                second: ['second', 'seconds'],
                minute: ['minute', 'minutes'],
                hour: ['hour', 'hours'],
                day: ['day', 'days'],
                week: ['week', 'weeks'],
                month: ['month', 'months'],
                year: ['year', 'years']
            },
            currencySymbols: {
                'UAH': '₴',
                'USD': '$',
                'EUR': '€',
                'GBP': '£',
                'JPY': '¥',
                'WINIX': '$WINIX'
            }
        }
    };

    /**
     * Оновлення конфігурації форматерів
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

        // Очищаємо кеш форматерів при зміні конфігурації
        for (const key in formattersCache) {
            delete formattersCache[key];
        }

        return config;
    }

    /**
     * Скидання конфігурації до значень за замовчуванням
     * @returns {Object} Конфігурація за замовчуванням
     */
    function resetConfig() {
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

        // Очищаємо кеш форматерів
        for (const key in formattersCache) {
            delete formattersCache[key];
        }

        return config;
    }

    /**
     * Отримання локалізованих даних для поточної локалі
     * @param {string} key - Ключ локалізованих даних
     * @param {string} locale - Локаль (опціонально)
     * @returns {*} Локалізовані дані
     */
    function getLocaleData(key, locale = config.locale) {
        const localeData = locales[locale] || locales['uk-UA'];

        if (!key) return localeData;

        const parts = key.split('.');
        let result = localeData;

        for (const part of parts) {
            if (result && result[part] !== undefined) {
                result = result[part];
            } else {
                return null;
            }
        }

        return result;
    }

    /**
     * Додавання нової локалі
     * @param {string} locale - Код локалі
     * @param {Object} data - Дані локалі
     */
    function addLocale(locale, data) {
        if (!locale || typeof locale !== 'string' || !data || typeof data !== 'object') {
            return false;
        }

        locales[locale] = data;
        return true;
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
        if (!locale || typeof locale !== 'string' || !locales[locale]) {
            return false;
        }

        config.locale = locale;

        // Очищаємо кеш форматерів при зміні локалі
        for (const key in formattersCache) {
            delete formattersCache[key];
        }

        return true;
    }

    /**
     * Визначення, чи доступний API Intl браузера
     * @param {string} feature - Назва функції Intl для перевірки
     * @returns {boolean} Чи доступна функція
     */
    function isIntlSupported(feature) {
        if (!feature) {
            return typeof Intl !== 'undefined';
        }

        // Перевіряємо наявність конкретної функції Intl
        switch (feature) {
            case 'NumberFormat':
                return typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function';
            case 'DateTimeFormat':
                return typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function';
            case 'RelativeTimeFormat':
                return typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function';
            case 'ListFormat':
                return typeof Intl !== 'undefined' && typeof Intl.ListFormat === 'function';
            default:
                return false;
        }
    }

    /**
     * Склонення слова залежно від числа
     * @param {number} number - Число
     * @param {string|Array} forms - Форми слова для різних чисел
     * @param {string} locale - Локаль (опціонально)
     * @returns {string} Правильна форма слова
     */
    function pluralize(number, forms, locale = config.locale) {
        // Визначаємо, які форми передані
        let one, few, many;

        if (Array.isArray(forms)) {
            [one, few, many] = forms;
            // Якщо передано менше трьох форм, використовуємо останню як many
            if (!many && few) many = few;
            if (!few && one) few = many = one;
        } else if (typeof forms === 'string') {
            // Для англійської мови (однина/множина)
            if (locale === 'en-US') {
                const parts = forms.split('|');
                one = parts[0];
                few = many = parts.length > 1 ? parts[1] : parts[0] + 's';
            } else {
                // Для української мови шукаємо в словнику
                const timeUnit = Object.keys(getLocaleData('timeUnits', locale) || {})
                    .find(unit => forms === unit);

                if (timeUnit) {
                    const unitForms = getLocaleData(`timeUnits.${timeUnit}`, locale);
                    if (unitForms) {
                        [one, few, many] = unitForms;
                    } else {
                        one = few = many = forms;
                    }
                } else {
                    one = few = many = forms;
                }
            }
        }

        // Визначаємо правильну форму за правилами мови
        if (locale === 'en-US') {
            return number === 1 ? one : few;
        } else {
            // Правила для української мови
            const absNumber = Math.abs(number);
            const lastDigit = absNumber % 10;
            const lastTwoDigits = absNumber % 100;

            if (lastDigit === 1 && lastTwoDigits !== 11) {
                return one;
            } else if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) {
                return few;
            } else {
                return many;
            }
        }
    }

    /**
     * Автоматичне визначення типу даних і форматування
     * @param {*} value - Значення для форматування
     * @param {Object} options - Опції форматування
     * @returns {string} Відформатоване значення
     */
    function autoFormat(value, options = {}) {
        // Визначаємо тип даних
        if (value === null || value === undefined) {
            return options.nullValue || '';
        }

        if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
            return formatDate(value, options);
        }

        if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
            // Якщо є ознаки, що це валюта
            if (options.isCurrency || (typeof options === 'string' && options.toLowerCase() === 'currency')) {
                return formatCurrency(parseFloat(value), options.currency || config.currency.defaultCurrency, options);
            }

            // Якщо є ознаки, що це відсоток
            if (options.isPercent || (typeof options === 'string' && options.toLowerCase() === 'percent')) {
                return formatPercent(parseFloat(value), options);
            }

            // Якщо це звичайне число
            return formatNumber(parseFloat(value), options);
        }

        if (typeof value === 'string') {
            return formatText(value, options);
        }

        if (typeof value === 'boolean') {
            return value ? (options.trueLabel || 'Так') : (options.falseLabel || 'Ні');
        }

        if (Array.isArray(value)) {
            // Форматуємо список
            if (isIntlSupported('ListFormat') && !options.customListFormat) {
                const listFormatter = new Intl.ListFormat(config.locale, {
                    style: options.listStyle || 'long',
                    type: options.listType || 'conjunction'
                });
                return listFormatter.format(value);
            }

            // Якщо Intl.ListFormat не підтримується або вказано користувацький формат
            const separator = options.listSeparator || ', ';
            const lastSeparator = options.lastSeparator || (config.locale === 'uk-UA' ? ' та ' : ' and ');

            if (value.length === 0) return '';
            if (value.length === 1) return String(value[0]);

            const lastItem = value[value.length - 1];
            const otherItems = value.slice(0, -1).join(separator);

            return otherItems + lastSeparator + lastItem;
        }

        // Для інших типів даних повертаємо рядкове представлення
        return String(value);
    }

    /**
     * Форматування числа з розділювачами
     * @param {number} number - Число для форматування
     * @param {Object} options - Опції форматування
     * @returns {string} Відформатоване число
     */
    function formatNumber(number, options = {}) {
        // Об'єднуємо опції з конфігурацією за замовчуванням
        const opts = Object.assign({}, config.number, options);
        const {
            decimals,
            decimalSeparator,
            thousandsSeparator,
            roundingMode,
            padDecimals,
            locale = config.locale
        } = opts;

        try {
            // Перевірка на NaN та Infinity
            if (!isFinite(number)) {
                return String(number);
            }

            // Використання Intl для форматування, якщо доступно
            if (isIntlSupported('NumberFormat')) {
                const cacheKey = `number_${locale}_${decimals}_${decimalSeparator}_${thousandsSeparator}_${padDecimals}`;

                if (!formattersCache[cacheKey]) {
                    // Створюємо новий форматтер
                    formattersCache[cacheKey] = new Intl.NumberFormat(locale, {
                        minimumFractionDigits: padDecimals ? decimals : 0,
                        maximumFractionDigits: decimals
                    });
                }

                let result = formattersCache[cacheKey].format(number);

                // Адаптуємо до користувацьких розділювачів, якщо вони вказані
                if (decimalSeparator !== '.' || thousandsSeparator !== ',') {
                    // Отримуємо розділювачі для поточної локалі
                    const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
                    let defaultDecimalSep = '.';
                    let defaultThousandSep = ',';

                    for (const part of parts) {
                        if (part.type === 'decimal') {
                            defaultDecimalSep = part.value;
                        } else if (part.type === 'group') {
                            defaultThousandSep = part.value;
                        }
                    }

                    // Замінюємо розділювачі на користувацькі
                    if (defaultDecimalSep !== decimalSeparator) {
                        result = result.replace(new RegExp('\\' + defaultDecimalSep, 'g'), decimalSeparator);
                    }

                    if (defaultThousandSep !== thousandsSeparator) {
                        result = result.replace(new RegExp('\\' + defaultThousandSep, 'g'), thousandsSeparator);
                    }
                }

                return result;
            }

            // Запасний варіант, якщо Intl не підтримується
            // Округлення числа
            let rounded;

            switch (roundingMode) {
                case 'floor':
                    rounded = Math.floor(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
                    break;
                case 'ceil':
                    rounded = Math.ceil(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
                    break;
                case 'round':
                default:
                    rounded = Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
            }

            // Розділяємо число на цілу та дробову частини
            const parts = rounded.toString().split('.');
            const integerPart = parts[0];
            let decimalPart = parts[1] || '';

            // Додаємо нулі, якщо потрібно
            if (padDecimals && decimalPart.length < decimals) {
                decimalPart = decimalPart.padEnd(decimals, '0');
            }

            // Додаємо розділювачі тисяч
            const integerFormatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

            // Повертаємо число з розділювачем десяткових знаків
            return decimals === 0 || !decimalPart ?
                integerFormatted :
                `${integerFormatted}${decimalSeparator}${decimalPart}`;
        } catch (error) {
            console.error('Помилка форматування числа:', error);
            return String(number);
        }
    }

    /**
     * Форматування валюти
     * @param {number} amount - Сума
     * @param {string} currency - Код валюти
     * @param {Object} options - Опції форматування
     * @returns {string} Відформатована валюта
     */
    function formatCurrency(amount, currency = config.currency.defaultCurrency, options = {}) {
        // Об'єднуємо опції з конфігурацією за замовчуванням
        const opts = Object.assign({}, config.currency, options);
        const {
            decimals,
            useSymbol,
            symbolPosition,
            locale = config.locale
        } = opts;

        try {
            // Перевірка на NaN та Infinity
            if (!isFinite(amount)) {
                return String(amount);
            }

            // Використовуємо Intl.NumberFormat, якщо доступний
            if (isIntlSupported('NumberFormat')) {
                const cacheKey = `currency_${locale}_${currency}_${decimals}_${useSymbol}_${symbolPosition}`;

                // Спочатку перевіряємо кеш
                if (!formattersCache[cacheKey]) {
                    // Якщо потрібно користувацьке розміщення символу валюти
                    if (symbolPosition !== 'auto' && useSymbol) {
                        // Створюємо форматтер без символу валюти
                        formattersCache[cacheKey] = {
                            formatter: new Intl.NumberFormat(locale, {
                                style: 'decimal',
                                minimumFractionDigits: decimals,
                                maximumFractionDigits: decimals
                            }),
                            customSymbol: true
                        };
                    } else {
                        // Створюємо форматтер зі стандартним розміщенням символу
                        formattersCache[cacheKey] = {
                            formatter: new Intl.NumberFormat(locale, {
                                style: 'currency',
                                currency: currency,
                                minimumFractionDigits: decimals,
                                maximumFractionDigits: decimals
                            }),
                            customSymbol: false
                        };
                    }
                }

                // Отримуємо кешований форматтер
                const { formatter, customSymbol } = formattersCache[cacheKey];

                if (customSymbol && useSymbol) {
                    // Додаємо символ у потрібну позицію
                    const formattedNumber = formatter.format(amount);
                    const symbol = getCurrencySymbol(currency, locale);

                    return symbolPosition === 'before' ?
                        `${symbol}${formattedNumber}` :
                        `${formattedNumber} ${symbol}`;
                } else {
                    // Використовуємо стандартне форматування
                    return formatter.format(amount);
                }
            }

            // Запасний варіант, якщо Intl недоступний
            const formattedNumber = formatNumber(amount, {
                decimals: decimals,
                locale: locale
            });

            if (!useSymbol) {
                return formattedNumber;
            }

            // Отримуємо символ валюти
            const symbol = getCurrencySymbol(currency, locale);

            // Повертаємо відформатовану валюту
            if (symbolPosition === 'before') {
                return `${symbol}${formattedNumber}`;
            } else {
                return `${formattedNumber} ${symbol}`;
            }
        } catch (error) {
            console.error('Помилка форматування валюти:', error);
            return `${amount} ${currency}`;
        }
    }

    /**
     * Отримання символу валюти
     * @param {string} currency - Код валюти
     * @param {string} locale - Локаль
     * @returns {string} Символ валюти
     */
    function getCurrencySymbol(currency, locale = config.locale) {
        const localeData = getLocaleData(null, locale);

        if (localeData && localeData.currencySymbols && localeData.currencySymbols[currency]) {
            return localeData.currencySymbols[currency];
        }

        // Стандартні символи валют
        const symbols = {
            'UAH': '₴',
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
            'RUB': '₽',
            'WINIX': '$WINIX'
        };

        return symbols[currency] || currency;
    }

    /**
     * Форматування відсотків
     * @param {number} value - Значення (0-1 або 0-100)
     * @param {Object} options - Опції форматування
     * @returns {string} Відформатований відсоток
     */
    function formatPercent(value, options = {}) {
        // Об'єднуємо опції з конфігурацією за замовчуванням
        const opts = Object.assign({}, config.percent, options);
        const {
            decimals,
            alreadyPercent = false,
            includeSymbol,
            padDecimals,
            locale = config.locale
        } = opts;

        try {
            // Перевірка на NaN та Infinity
            if (!isFinite(value)) {
                return String(value);
            }

            // Конвертуємо в відсотки, якщо потрібно
            const percentValue = alreadyPercent ? value : value * 100;

            // Використовуємо Intl.NumberFormat, якщо доступний
            if (isIntlSupported('NumberFormat')) {
                const cacheKey = `percent_${locale}_${decimals}_${includeSymbol}_${padDecimals}`;

                if (!formattersCache[cacheKey]) {
                    formattersCache[cacheKey] = new Intl.NumberFormat(locale, {
                        style: includeSymbol ? 'percent' : 'decimal',
                        minimumFractionDigits: padDecimals ? decimals : 0,
                        maximumFractionDigits: decimals
                    });
                }

                if (includeSymbol) {
                    // Для стилю 'percent' значення має бути в діапазоні 0-1
                    return formattersCache[cacheKey].format(alreadyPercent ? percentValue / 100 : value);
                } else {
                    // Для стилю 'decimal' форматуємо значення як звичайне число
                    return formattersCache[cacheKey].format(percentValue);
                }
            }

            // Запасний варіант, якщо Intl недоступний
            const formattedValue = formatNumber(percentValue, {
                decimals: decimals,
                padDecimals: padDecimals,
                locale: locale
            });

            // Повертаємо відформатований відсоток
            return includeSymbol ? `${formattedValue}%` : formattedValue;
        } catch (error) {
            console.error('Помилка форматування відсотка:', error);
            return `${value}%`;
        }
    }

    /**
     * Перетворення різних форматів дати в об'єкт Date
     * @param {Date|string|number} date - Дата для парсингу
     * @param {string} format - Формат дати (опціонально)
     * @returns {Date|null} Об'єкт Date або null
     */
    function parseDate(date, format = null) {
        if (date instanceof Date) {
            return date;
        }

        if (typeof date === 'number') {
            return new Date(date);
        }

        if (typeof date === 'string') {
            // Спроба парсити ISO формат
            const isoDate = new Date(date);
            if (!isNaN(isoDate.getTime())) {
                return isoDate;
            }

            // Якщо вказано формат, використовуємо його для парсингу
            if (format) {
                return parseDateFromFormat(date, format);
            }

            // Спроба парсити формат локалізованої дати
            const localeFormat = config.date.format;
            const dateFromFormat = parseDateFromFormat(date, localeFormat);
            if (dateFromFormat) {
                return dateFromFormat;
            }

            // Спробуємо різні стандартні формати
            const formats = ['dd.MM.yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];
            for (const fmt of formats) {
                const result = parseDateFromFormat(date, fmt);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    /**
     * Парсинг дати з вказаним форматом
     * @param {string} dateStr - Рядок з датою
     * @param {string} format - Формат дати
     * @returns {Date|null} Об'єкт Date або null
     */
    function parseDateFromFormat(dateStr, format) {
        if (!dateStr || !format) {
            return null;
        }

        // Визначаємо розділювач у форматі
        let separator = '';
        for (const char of format) {
            if (!'dMmyYHhsS'.includes(char)) {
                separator = char;
                break;
            }
        }

        if (!separator) {
            return null;
        }

        // Створюємо масиви частин
        const datePartsStr = dateStr.split(separator);
        const formatParts = format.split(separator);

        if (datePartsStr.length !== formatParts.length) {
            return null;
        }

        let day = 1, month = 0, year = 2000, hours = 0, minutes = 0, seconds = 0;

        // Прапорці для кожної обов'язкової частини дати
        let hasDay = false, hasMonth = false, hasYear = false;

        // Парсимо кожну частину
        for (let i = 0; i < formatParts.length; i++) {
            const part = datePartsStr[i];
            const formatPart = formatParts[i];

            if (formatPart.includes('d')) {
                day = parseInt(part, 10);
                hasDay = true;
            } else if (formatPart.includes('M')) {
                month = parseInt(part, 10) - 1; // Місяці в JS з 0
                hasMonth = true;
            } else if (formatPart.includes('y')) {
                year = parseInt(part, 10);
                // Якщо рік двоцифровий
                if (year < 100) {
                    const currentYear = new Date().getFullYear();
                    const century = Math.floor(currentYear / 100) * 100;

                    if (year > currentYear % 100 + 20) {
                        year = century - 100 + year;
                    } else {
                        year = century + year;
                    }
                }
                hasYear = true;
            } else if (formatPart.includes('H') || formatPart.includes('h')) {
                hours = parseInt(part, 10);
            } else if (formatPart.includes('m')) {
                minutes = parseInt(part, 10);
            } else if (formatPart.includes('s')) {
                seconds = parseInt(part, 10);
            }
        }

        // Перевіряємо, чи всі обов'язкові частини присутні
        if (!hasDay || !hasMonth || !hasYear) {
            return null;
        }

        // Створюємо дату
        const date = new Date(year, month, day, hours, minutes, seconds);

        // Перевіряємо валідність створеної дати
        if (
            isNaN(date.getTime()) ||
            date.getFullYear() !== year ||
            date.getMonth() !== month ||
            date.getDate() !== day
        ) {
            return null;
        }

        return date;
    }

    /**
     * Форматування дати
     * @param {Date|string|number} date - Дата для форматування
     * @param {string|Object} format - Формат або опції форматування
     * @returns {string} Відформатована дата
     */
    function formatDate(date, format = config.date.format) {
        try {
            // Конвертуємо дату в об'єкт Date
            const dateObj = parseDate(date);

            // Якщо дата невалідна, повертаємо пустий рядок
            if (!dateObj || isNaN(dateObj.getTime())) {
                return '';
            }

            // Якщо формат - це об'єкт з опціями
            if (typeof format === 'object') {
                const {
                    locale = config.locale,
                    dateStyle = 'medium',
                    timeStyle = undefined,
                    format: formatStr = undefined
                } = format;

                // Якщо вказано формат як рядок, використовуємо його
                if (formatStr) {
                    return formatDateByPattern(dateObj, formatStr, locale);
                }

                // Використовуємо Intl.DateTimeFormat, якщо доступний
                if (isIntlSupported('DateTimeFormat')) {
                    const options = {
                        dateStyle: dateStyle
                    };

                    if (timeStyle) {
                        options.timeStyle = timeStyle;
                    }

                    const cacheKey = `date_${locale}_${dateStyle}_${timeStyle || 'none'}`;

                    if (!formattersCache[cacheKey]) {
                        formattersCache[cacheKey] = new Intl.DateTimeFormat(locale, options);
                    }

                    return formattersCache[cacheKey].format(dateObj);
                }
            }

            // Якщо формат - це рядок або Intl недоступний
            if (typeof format === 'string') {
                return formatDateByPattern(dateObj, format);
            }

            // За замовчуванням
            return dateObj.toLocaleDateString(config.locale);
        } catch (error) {
            console.error('Помилка форматування дати:', error);
            return typeof date === 'string' ? date : '';
        }
    }

    /**
     * Форматування дати за шаблоном
     * @param {Date} dateObj - Об'єкт Date
     * @param {string} pattern - Шаблон форматування
     * @param {string} locale - Локаль
     * @returns {string} Відформатована дата
     */
    function formatDateByPattern(dateObj, pattern, locale = config.locale) {
        if (!dateObj || !pattern) {
            return '';
        }

        const localeData = getLocaleData(null, locale);
        const day = dateObj.getDate();
        const month = dateObj.getMonth();
        const year = dateObj.getFullYear();
        const hours = dateObj.getHours();
        const minutes = dateObj.getMinutes();
        const seconds = dateObj.getSeconds();
        const weekDay = dateObj.getDay();

        // Функція для додавання ведучих нулів
        const padZero = num => String(num).padStart(2, '0');

        // Заміна шаблонів
        return pattern
            // День (01-31)
            .replace(/dd/g, padZero(day))
            // День (1-31)
            .replace(/d/g, day)
            // Місяць (01-12)
            .replace(/MM/g, padZero(month + 1))
            // Місяць (1-12)
            .replace(/M/g, month + 1)
            // Рік (4 цифри)
            .replace(/yyyy/g, year)
            // Рік (2 цифри)
            .replace(/yy/g, String(year).slice(-2))
            // Години (00-23)
            .replace(/HH/g, padZero(hours))
            // Години (0-23)
            .replace(/H/g, hours)
            // Години (01-12)
            .replace(/hh/g, padZero(hours % 12 || 12))
            // Години (1-12)
            .replace(/h/g, hours % 12 || 12)
            // Хвилини (00-59)
            .replace(/mm/g, padZero(minutes))
            // Хвилини (0-59)
            .replace(/m(?!\w)/g, minutes)
            // Секунди (00-59)
            .replace(/ss/g, padZero(seconds))
            // Секунди (0-59)
            .replace(/s(?!\w)/g, seconds)
            // AM/PM
            .replace(/a/g, hours < 12 ? 'AM' : 'PM')
            // am/pm
            .replace(/p/g, hours < 12 ? 'am' : 'pm')
            // День тижня (повна назва)
            .replace(/EEEE/g, localeData.days[weekDay])
            // День тижня (скорочена назва)
            .replace(/EEE/g, localeData.daysShort[weekDay])
            // Місяць (повна назва)
            .replace(/MMMM/g, localeData.months[month])
            // Місяць (скорочена назва)
            .replace(/MMM/g, localeData.monthsShort[month]);
    }

    /**
     * Форматування відносного часу
     * @param {Date|string|number} date - Дата для порівняння
     * @param {Object} options - Опції форматування
     * @returns {string} Відносний час
     */
    function formatRelativeTime(date, options = {}) {
        const {
            now = new Date(),
            locale = config.locale,
            style = 'long' // 'long', 'short', 'narrow'
        } = options;

        try {
            // Конвертуємо дату в об'єкт Date
            const dateObj = parseDate(date);

            // Якщо дата невалідна, повертаємо пустий рядок
            if (!dateObj || isNaN(dateObj.getTime())) {
                return '';
            }

            // Використовуємо Intl.RelativeTimeFormat, якщо доступний
            if (isIntlSupported('RelativeTimeFormat')) {
                // Кешуємо форматтер для продуктивності
                const cacheKey = `relative_${locale}_${style}`;

                if (!formattersCache[cacheKey]) {
                    formattersCache[cacheKey] = new Intl.RelativeTimeFormat(locale, { style });
                }

                const rtf = formattersCache[cacheKey];
                const nowObj = parseDate(now);
                const diffMs = dateObj - nowObj;

                // Визначаємо найбільш підходящу одиницю вимірювання
                if (Math.abs(diffMs) < 60000) { // менше хвилини
                    return rtf.format(Math.round(diffMs / 1000), 'second');
                } else if (Math.abs(diffMs) < 3600000) { // менше години
                    return rtf.format(Math.round(diffMs / 60000), 'minute');
                } else if (Math.abs(diffMs) < 86400000) { // менше доби
                    return rtf.format(Math.round(diffMs / 3600000), 'hour');
                } else if (Math.abs(diffMs) < 2592000000) { // менше місяця (30 днів)
                    return rtf.format(Math.round(diffMs / 86400000), 'day');
                } else if (Math.abs(diffMs) < 31536000000) { // менше року
                    return rtf.format(Math.round(diffMs / 2592000000), 'month');
                } else {
                    return rtf.format(Math.round(diffMs / 31536000000), 'year');
                }
            }

            // Запасний варіант, якщо Intl недоступний
            const nowObj = parseDate(now);
            const diffMs = dateObj - nowObj;

            const seconds = Math.abs(Math.round(diffMs / 1000));
            const minutes = Math.abs(Math.round(diffMs / 60000));
            const hours = Math.abs(Math.round(diffMs / 3600000));
            const days = Math.abs(Math.round(diffMs / 86400000));

            const inPast = diffMs < 0;

            // Отримуємо локалізовані дані
            const timeUnits = getLocaleData('timeUnits', locale);

            if (seconds < 60) {
                return inPast ? 'щойно' : 'за кілька секунд';
            } else if (minutes < 60) {
                return inPast ?
                    `${minutes} ${pluralize(minutes, 'minute', locale)} тому` :
                    `через ${minutes} ${pluralize(minutes, 'minute', locale)}`;
            } else if (hours < 24) {
                return inPast ?
                    `${hours} ${pluralize(hours, 'hour', locale)} тому` :
                    `через ${hours} ${pluralize(hours, 'hour', locale)}`;
            } else {
                return inPast ?
                    `${days} ${pluralize(days, 'day', locale)} тому` :
                    `через ${days} ${pluralize(days, 'day', locale)}`;
            }
        } catch (error) {
            console.error('Помилка форматування відносного часу:', error);
            return '';
        }
    }

    /**
     * Форматування залишку часу
     * @param {Date|string|number} endDate - Кінцева дата
     * @param {Object} options - Опції форматування
     * @returns {string} Відформатований залишок часу
     */
    function formatTimeLeft(endDate, options = {}) {
        const {
            now = new Date(),
            includeSeconds = true,
            shortFormat = false,
            hideZeroUnits = true,
            locale = config.locale
        } = options;

        try {
            // Конвертуємо дати в об'єкти Date
            const endDateObj = parseDate(endDate);
            const nowObj = parseDate(now);

            // Якщо дата невалідна, повертаємо пустий рядок
            if (!endDateObj || isNaN(endDateObj.getTime())) {
                return '';
            }

            // Запасний варіант, якщо TimeUtils недоступний
            let diffMs = endDateObj - nowObj;

            // Якщо час вийшов
            if (diffMs <= 0) {
                return shortFormat ? '0с' : getLocalizedText('expired', 'Закінчено', locale);
            }

            // Обчислюємо дні, години, хвилини, секунди
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            diffMs %= (1000 * 60 * 60 * 24);

            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            diffMs %= (1000 * 60 * 60);

            const minutes = Math.floor(diffMs / (1000 * 60));
            diffMs %= (1000 * 60);

            const seconds = Math.floor(diffMs / 1000);

            // Форматуємо вивід
            const parts = [];

            // Функція для додавання частини
            const addPart = (value, unit, shortUnit) => {
                if (value > 0 || (!hideZeroUnits && (parts.length > 0 || value === 0))) {
                    if (shortFormat) {
                        parts.push(`${value}${shortUnit}`);
                    } else {
                        parts.push(`${value} ${pluralize(value, unit, locale)}`);
                    }
                }
            };

            // Додаємо дні, години, хвилини
            addPart(days, 'day', 'д');
            addPart(hours, 'hour', 'г');
            addPart(minutes, 'minute', 'хв');

            // Додаємо секунди, якщо потрібно
            if (includeSeconds) {
                addPart(seconds, 'second', 'с');
            }

            // Якщо немає жодної частини, додаємо нуль секунд
            if (parts.length === 0) {
                if (shortFormat) {
                    parts.push(`0с`);
                } else {
                    parts.push(`0 ${pluralize(0, 'second', locale)}`);
                }
            }

            // З'єднуємо частини
            return parts.join(' ');
        } catch (error) {
            console.error('Помилка форматування залишку часу:', error);
            return '';
        }
    }

    /**
     * Форматування розміру файлу
     * @param {number} bytes - Розмір в байтах
     * @param {Object} options - Опції форматування
     * @returns {string} Відформатований розмір
     */
    function formatFileSize(bytes, options = {}) {
        const {
            decimals = 2,
            binary = false, // Якщо true, використовуємо степені 1024, інакше 1000
            includeUnit = true,
            locale = config.locale
        } = options;

        try {
            // Перевірка на NaN та Infinity
            if (!isFinite(bytes)) {
                return String(bytes);
            }

            // Для нульового розміру
            if (bytes === 0) {
                return includeUnit ? '0 B' : '0';
            }

            // Визначаємо базу та суфікси
            const base = binary ? 1024 : 1000;

            // Визначаємо локалізовані або дефолтні суфікси
            let units;

            if (locale === 'uk-UA') {
                units = binary ?
                    ['Б', 'КіБ', 'МіБ', 'ГіБ', 'ТіБ', 'ПіБ', 'ЕіБ', 'ЗіБ', 'ЙіБ'] :
                    ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ', 'ПБ', 'ЕБ', 'ЗБ', 'ЙБ'];
            } else {
                units = binary ?
                    ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'] :
                    ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
            }

            // Обчислюємо порядок та індекс
            const i = Math.floor(Math.log(bytes) / Math.log(base));
            const size = bytes / Math.pow(base, i);

            // Форматуємо число
            const formattedSize = formatNumber(size, {
                decimals: decimals,
                locale: locale,
                padDecimals: false
            });

            // Повертаємо відформатований розмір
            return includeUnit ? `${formattedSize} ${units[i]}` : formattedSize;
        } catch (error) {
            console.error('Помилка форматування розміру файлу:', error);
            return `${bytes} B`;
        }
    }

    /**
     * Форматування телефонного номера
     * @param {string} phone - Телефонний номер
     * @param {string|Object} format - Формат для відображення або опції
     * @returns {string} Відформатований номер
     */
    function formatPhone(phone, format = '+38 (0##) ###-##-##') {
        // Якщо format - це об'єкт, витягуємо шаблон
        let phoneFormat = format;
        let locale = config.locale;

        if (typeof format === 'object') {
            phoneFormat = format.format || '+38 (0##) ###-##-##';
            locale = format.locale || config.locale;
        }

        try {
            // Видаляємо всі нецифрові символи
            const digitsOnly = String(phone).replace(/\D/g, '');

            // Якщо номер порожній, повертаємо порожній рядок
            if (!digitsOnly) {
                return '';
            }

            // Визначаємо формат в залежності від локалі, якщо не вказано явно
            if (phoneFormat === 'auto') {
                if (locale === 'uk-UA') {
                    phoneFormat = '+38 (0##) ###-##-##';
                } else {
                    phoneFormat = '+# (###) ###-####';
                }
            }

            // Замінюємо # на цифри з номера
            let result = phoneFormat;
            let digitIndex = 0;

            for (let i = 0; i < result.length; i++) {
                if (result[i] === '#') {
                    if (digitIndex < digitsOnly.length) {
                        result = result.substring(0, i) + digitsOnly[digitIndex++] + result.substring(i + 1);
                    } else {
                        result = result.substring(0, i) + '_' + result.substring(i + 1);
                    }
                }
            }

            return result;
        } catch (error) {
            console.error('Помилка форматування телефонного номера:', error);
            return String(phone);
        }
    }

    /**
     * Форматування тексту для відображення в HTML
     * @param {string} text - Текст для форматування
     * @param {Object} options - Опції форматування
     * @returns {string} Відформатований текст
     */
    function formatText(text, options = {}) {
        // Об'єднуємо опції з конфігурацією за замовчуванням
        const opts = Object.assign({}, config.text, options);
        const {
            maxLength,
            ellipsis,
            preserveWords,
            preserveLines,
            escapeHtml
        } = opts;

        try {
            if (!text) {
                return '';
            }

            let result = String(text);

            // Екрануємо HTML, якщо потрібно
            if (escapeHtml) {
                result = escapeHtmlChars(result);
            }

            // Обмежуємо довжину, якщо потрібно
            if (maxLength > 0 && result.length > maxLength) {
                if (preserveWords) {
                    // Знаходимо останнє слово, що влазить в maxLength
                    let cutIndex = maxLength;
                    while (cutIndex > 0 && result[cutIndex] !== ' ' && result[cutIndex] !== '\n') {
                        cutIndex--;
                    }

                    // Якщо знайдено пробіл або кінець рядка, обрізаємо тут
                    if (cutIndex > 0) {
                        result = result.substring(0, cutIndex) + ellipsis;
                    } else {
                        // Якщо немає пробілів, просто обрізаємо по maxLength
                        result = result.substring(0, maxLength) + ellipsis;
                    }
                } else {
                    // Просто обрізаємо текст
                    result = result.substring(0, maxLength) + ellipsis;
                }
            }

            // Зберігаємо переноси рядків, якщо потрібно
            if (preserveLines) {
                result = result.replace(/\n/g, '<br>');
            }

            return result;
        } catch (error) {
            console.error('Помилка форматування тексту:', error);
            return escapeHtml ? escapeHtmlChars(String(text)) : String(text);
        }
    }

    /**
     * Екранування HTML спецсимволів
     * @param {string} text - Текст для екранування
     * @returns {string} Екранований текст
     */
    function escapeHtmlChars(text) {
        if (!text) return '';

        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };

        return String(text).replace(/[&<>"'`=\/]/g, char => escapeMap[char]);
    }

    /**
     * Отримання локалізованого тексту
     * @param {string} key - Ключ тексту
     * @param {string} defaultText - Текст за замовчуванням
     * @param {string} locale - Локаль
     * @returns {string} Локалізований текст
     */
    function getLocalizedText(key, defaultText, locale = config.locale) {
        // Пробуємо використати WinixLanguage, якщо доступний
        if (window.WinixLanguage && typeof window.WinixLanguage.get === 'function') {
            const localizedText = window.WinixLanguage.get(key);
            if (localizedText) return localizedText;
        }

        // Інакше повертаємо текст за замовчуванням
        return defaultText;
    }

    // Ініціалізація модуля
    function init() {
        // Визначаємо мову браузера
        try {
            const browserLocale = navigator.language;

            // Якщо мова браузера підтримується
            if (browserLocale.startsWith('uk') && locales['uk-UA']) {
                config.locale = 'uk-UA';
            } else if (browserLocale.startsWith('en') && locales['en-US']) {
                config.locale = 'en-US';
            }
        } catch (e) {
            console.warn('Не вдалося визначити мову браузера:', e);
        }

        // Пробуємо отримати мову з localStorage
        try {
            if (window.StorageUtils) {
                const storedLocale = window.StorageUtils.getItem('language');
                if (storedLocale && locales[storedLocale]) {
                    config.locale = storedLocale;
                }
            } else if (localStorage) {
                const storedLocale = localStorage.getItem('language') || localStorage.getItem('winix_language');
                if (storedLocale && locales[storedLocale]) {
                    config.locale = storedLocale;
                }
            }
        } catch (e) {
            console.warn('Не вдалося отримати мову з localStorage:', e);
        }

        // Підписуємося на подію зміни мови
        document.addEventListener('language-changed', function(event) {
            if (event.detail && event.detail.language && locales[event.detail.language]) {
                setLocale(event.detail.language);
            }
        });

        return true;
    }

    // Запускаємо ініціалізацію
    init();

    // Публічний API
    return {
        // Основні функції форматування
        formatNumber,
        formatCurrency,
        formatPercent,
        formatDate,
        formatRelativeTime,
        formatTimeLeft,
        formatFileSize,
        formatPhone,
        formatText,
        autoFormat,

        // Утиліти для роботи з датами
        parseDate,

        // Утиліти для роботи з текстом
        pluralize,
        escapeHtml: escapeHtmlChars,

        // Налаштування
        getConfig: () => JSON.parse(JSON.stringify(config)),
        updateConfig,
        resetConfig,

        // Локалізація
        setLocale,
        getCurrentLocale,
        addLocale,
        getLocaleData,

        // Утиліти
        isSupportedByBrowser: isIntlSupported
    };
})();