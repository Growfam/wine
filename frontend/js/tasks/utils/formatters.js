/**
 * Formatters - утиліти для форматування різних типів даних
 * Відповідає за:
 * - Форматування чисел, дат, валют
 * - Перетворення даних у людинозрозумілий формат
 * - Форматування тексту для відображення
 */

window.Formatters = (function() {
    // Кеш форматтерів
    const formattersCache = {};

    /**
     * Форматування числа з розділювачами
     * @param {number} number - Число для форматування
     * @param {Object} options - Опції форматування
     * @returns {string} Відформатоване число
     */
    function formatNumber(number, options = {}) {
        const {
            decimals = 2,
            decimalSeparator = '.',
            thousandsSeparator = ' ',
            roundingMode = 'round', // 'round', 'floor', 'ceil'
            padDecimals = false
        } = options;

        try {
            // Перевірка на NaN та Infinity
            if (!isFinite(number)) {
                return String(number);
            }

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
    function formatCurrency(amount, currency = 'UAH', options = {}) {
        const {
            locale = 'uk-UA',
            useSymbol = true,
            symbolPosition = 'after', // 'before', 'after'
            decimals = 2
        } = options;

        try {
            // Перевірка на NaN та Infinity
            if (!isFinite(amount)) {
                return String(amount);
            }

            // Використовуємо Intl.NumberFormat, якщо доступний
            if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
                const key = `${locale}_${currency}_${useSymbol}_${decimals}`;

                // Використовуємо кешований форматтер, якщо є
                if (!formattersCache[key]) {
                    formattersCache[key] = new Intl.NumberFormat(locale, {
                        style: 'currency',
                        currency: currency,
                        minimumFractionDigits: decimals,
                        maximumFractionDigits: decimals
                    });
                }

                return formattersCache[key].format(amount);
            }

            // Запасний варіант, якщо Intl недоступний
            const formattedNumber = formatNumber(amount, {
                decimals: decimals,
                decimalSeparator: ',',
                thousandsSeparator: ' '
            });

            // Символи валют
            const symbols = {
                'UAH': '₴',
                'USD': '$',
                'EUR': '€',
                'GBP': '£',
                'JPY': '¥',
                'RUB': '₽',
                'WINIX': 'WINIX'
            };

            const symbol = useSymbol ? (symbols[currency] || currency) : currency;

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
     * Форматування відсотків
     * @param {number} value - Значення (0-1 або 0-100)
     * @param {Object} options - Опції форматування
     * @returns {string} Відформатований відсоток
     */
    function formatPercent(value, options = {}) {
        const {
            decimals = 1,
            alreadyPercent = false, // Якщо true, значення вже в відсотках (0-100)
            includeSymbol = true,
            padDecimals = false
        } = options;

        try {
            // Перевірка на NaN та Infinity
            if (!isFinite(value)) {
                return String(value);
            }

            // Конвертуємо в відсотки, якщо потрібно
            const percentValue = alreadyPercent ? value : value * 100;

            // Форматуємо число
            const formattedValue = formatNumber(percentValue, {
                decimals: decimals,
                padDecimals: padDecimals
            });

            // Повертаємо відформатований відсоток
            return includeSymbol ? `${formattedValue}%` : formattedValue;
        } catch (error) {
            console.error('Помилка форматування відсотка:', error);
            return `${value}%`;
        }
    }

    /**
     * Форматування дати
     * @param {Date|string|number} date - Дата для форматування
     * @param {string|Object} format - Формат або опції форматування
     * @returns {string} Відформатована дата
     */
    function formatDate(date, format = 'dd.MM.yyyy') {
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
                    locale = 'uk-UA',
                    dateStyle = 'medium',
                    timeStyle = undefined
                } = format;

                // Використовуємо Intl.DateTimeFormat, якщо доступний
                if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
                    const options = {
                        dateStyle: dateStyle
                    };

                    if (timeStyle) {
                        options.timeStyle = timeStyle;
                    }

                    return new Intl.DateTimeFormat(locale, options).format(dateObj);
                }
            }

            // Якщо це рядок-формат або Intl недоступний, використовуємо шаблонну заміну
            if (typeof format === 'string') {
                const padZero = (num) => String(num).padStart(2, '0');

                const day = padZero(dateObj.getDate());
                const month = padZero(dateObj.getMonth() + 1);
                const year = dateObj.getFullYear();
                const hours = padZero(dateObj.getHours());
                const minutes = padZero(dateObj.getMinutes());
                const seconds = padZero(dateObj.getSeconds());

                return format
                    .replace('dd', day)
                    .replace('MM', month)
                    .replace('yyyy', year)
                    .replace('yy', String(year).slice(2))
                    .replace('HH', hours)
                    .replace('mm', minutes)
                    .replace('ss', seconds);
            }

            // За замовчуванням
            return dateObj.toLocaleDateString();
        } catch (error) {
            console.error('Помилка форматування дати:', error);
            return String(date);
        }
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
            locale = 'uk-UA',
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
            if (typeof Intl !== 'undefined' && Intl.RelativeTimeFormat) {
                const rtf = new Intl.RelativeTimeFormat(locale, { style });

                const nowObj = parseDate(now);
                const diffMs = dateObj - nowObj;

                if (Math.abs(diffMs) < 60000) { // менше хвилини
                    return rtf.format(Math.round(diffMs / 1000), 'second');
                } else if (Math.abs(diffMs) < 3600000) { // менше години
                    return rtf.format(Math.round(diffMs / 60000), 'minute');
                } else if (Math.abs(diffMs) < 86400000) { // менше доби
                    return rtf.format(Math.round(diffMs / 3600000), 'hour');
                } else if (Math.abs(diffMs) < 2592000000) { // менше місяця
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
            const inFuture = diffMs > 0;

            if (seconds < 60) {
                return inPast ? 'щойно' : 'за кілька секунд';
            } else if (minutes < 60) {
                return inPast ?
                    `${minutes} ${pluralize(minutes, 'хвилину', 'хвилини', 'хвилин')} тому` :
                    `через ${minutes} ${pluralize(minutes, 'хвилину', 'хвилини', 'хвилин')}`;
            } else if (hours < 24) {
                return inPast ?
                    `${hours} ${pluralize(hours, 'годину', 'години', 'годин')} тому` :
                    `через ${hours} ${pluralize(hours, 'годину', 'години', 'годин')}`;
            } else {
                return inPast ?
                    `${days} ${pluralize(days, 'день', 'дні', 'днів')} тому` :
                    `через ${days} ${pluralize(days, 'день', 'дні', 'днів')}`;
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
            hideZeroUnits = true
        } = options;

        try {
            // Конвертуємо дати в об'єкти Date
            const endDateObj = parseDate(endDate);
            const nowObj = parseDate(now);

            // Якщо дата невалідна, повертаємо пустий рядок
            if (!endDateObj || isNaN(endDateObj.getTime())) {
                return '';
            }

            // Якщо TimeUtils доступний, використовуємо його
            if (window.TimeUtils && window.TimeUtils.formatTimeLeft) {
                return window.TimeUtils.formatTimeLeft(endDateObj, {
                    showSeconds: includeSeconds,
                    shortFormat: shortFormat,
                    hideZeroUnits: hideZeroUnits
                });
            }

            // Запасний варіант, якщо TimeUtils недоступний
            let diffMs = endDateObj - nowObj;

            // Якщо час вийшов
            if (diffMs <= 0) {
                return shortFormat ? '0с' : 'Закінчено';
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

            // Додаємо дні, якщо є
            if (days > 0 || (!hideZeroUnits && days === 0 && (shortFormat || parts.length > 0))) {
                parts.push(shortFormat ? `${days}д` : `${days} ${pluralize(days, 'день', 'дні', 'днів')}`);
            }

            // Додаємо години, якщо є
            if (hours > 0 || (!hideZeroUnits && hours === 0 && (shortFormat || parts.length > 0))) {
                parts.push(shortFormat ? `${hours}г` : `${hours} ${pluralize(hours, 'година', 'години', 'годин')}`);
            }

            // Додаємо хвилини, якщо є або якщо немає більших одиниць
            if (minutes > 0 || days === 0 && hours === 0 || (!hideZeroUnits && minutes === 0 && (shortFormat || parts.length > 0))) {
                parts.push(shortFormat ? `${minutes}хв` : `${minutes} ${pluralize(minutes, 'хвилина', 'хвилини', 'хвилин')}`);
            }

            // Додаємо секунди, якщо потрібно
            if (includeSeconds && (seconds > 0 || parts.length === 0 || (!hideZeroUnits && seconds === 0 && parts.length > 0))) {
                parts.push(shortFormat ? `${seconds}с` : `${seconds} ${pluralize(seconds, 'секунда', 'секунди', 'секунд')}`);
            }

            // З'єднуємо частини
            return parts.join(shortFormat ? ' ' : ' ');
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
            includeUnit = true
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
            const units = binary ?
                ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'] :
                ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

            // Обчислюємо порядок та індекс
            const i = Math.floor(Math.log(bytes) / Math.log(base));
            const size = bytes / Math.pow(base, i);

            // Форматуємо число
            const formattedSize = formatNumber(size, {
                decimals: decimals,
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
     * @param {string} format - Формат для відображення
     * @returns {string} Відформатований номер
     */
    function formatPhone(phone, format = '+38 (0##) ###-##-##') {
        try {
            // Видаляємо всі нецифрові символи
            const digitsOnly = String(phone).replace(/\D/g, '');

            // Якщо номер порожній, повертаємо порожній рядок
            if (!digitsOnly) {
                return '';
            }

            // Замінюємо # на цифри з номера
            let result = format;
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
        const {
            maxLength = 0,
            ellipsis = '...',
            preserveWords = true,
            preserveLines = true,
            escapeHtml = true
        } = options;

        try {
            if (!text) {
                return '';
            }

            let result = String(text);

            // Екрануємо HTML, якщо потрібно
            if (escapeHtml) {
                result = result
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
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
            return String(text);
        }
    }

    /**
     * Перетворення різних форматів дати в об'єкт Date
     * @param {Date|string|number} date - Дата для парсингу
     * @returns {Date|null} Об'єкт Date або null
     */
    function parseDate(date) {
        if (date instanceof Date) {
            return date;
        }

        if (typeof date === 'string') {
            // Перевіряємо ISO формат
            const isoDate = new Date(date);
            if (!isNaN(isoDate.getTime())) {
                return isoDate;
            }

            // Спроба парсити український формат дати (дд.мм.рррр)
            const dateParts = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
            if (dateParts) {
                return new Date(parseInt(dateParts[3]), parseInt(dateParts[2]) - 1, parseInt(dateParts[1]));
            }

            return null;
        }

        if (typeof date === 'number') {
            return new Date(date);
        }

        return null;
    }

    /**
     * Склонення слова залежно від числа
     * @param {number} number - Число
     * @param {string} one - Форма для 1
     * @param {string} few - Форма для 2-4
     * @param {string} many - Форма для 5-20
     * @returns {string} Правильна форма слова
     */
    function pluralize(number, one, few, many) {
        if (number % 10 === 1 && number % 100 !== 11) {
            return one;
        } else if ([2, 3, 4].includes(number % 10) && ![12, 13, 14].includes(number % 100)) {
            return few;
        } else {
            return many;
        }
    }

    // Публічний API
    return {
        formatNumber,
        formatCurrency,
        formatPercent,
        formatDate,
        formatRelativeTime,
        formatTimeLeft,
        formatFileSize,
        formatPhone,
        formatText,
        parseDate,
        pluralize
    };
})();