/**
 * Formatters - оптимізований модуль форматування даних
 * Відповідає за:
 * - Уніфіковане форматування різних типів даних
 * - Підготовку даних для відправки в API
 * - Обробку отриманих даних з API
 * - Локалізовані формати чисел, дат та валют
 *
 * @version 2.0.0
 */

window.Formatters = (function() {
    // Кеш форматтерів для оптимізації
    const formattersCache = {};

    // Налаштування для API
    const apiFormatSettings = {
        dateFormat: 'ISO',
        decimalSeparator: '.',
        thousandsSeparator: '',
        currencyFormat: 'numeric',
        preferNumbersAsStrings: false,
        timeZoneHandling: 'utc'
    };

    /**
     * Форматування числа
     * @param {number} number - Число для форматування
     * @param {Object} options - Опції форматування
     * @returns {string|number} Відформатоване число
     */
    function formatNumber(number, options = {}) {
        // Стандартні параметри
        const {
            decimals = 2,
            decimalSeparator = '.',
            thousandsSeparator = ' ',
            roundingMode = 'round',
            padDecimals = false,
            forApi = false
        } = options;

        try {
            // Перевірка на NaN та Infinity
            if (!isFinite(number)) {
                return String(number);
            }

            // Для API використовуємо специфічні налаштування
            const actualDecimalSeparator = forApi ? apiFormatSettings.decimalSeparator : decimalSeparator;
            const actualThousandsSeparator = forApi ? apiFormatSettings.thousandsSeparator : thousandsSeparator;

            // Округлення числа
            let rounded;
            const factor = Math.pow(10, decimals);

            switch (roundingMode) {
                case 'floor': rounded = Math.floor(number * factor) / factor; break;
                case 'ceil': rounded = Math.ceil(number * factor) / factor; break;
                case 'round': default: rounded = Math.round(number * factor) / factor;
            }

            // Для API повертаємо число, якщо потрібно
            if (forApi && apiFormatSettings.preferNumbersAsStrings === false) {
                return rounded;
            }

            // Розділяємо число на цілу та дробову частини
            const parts = rounded.toString().split('.');
            const integerPart = parts[0];
            let decimalPart = parts[1] || '';

            // Додаємо нулі, якщо потрібно
            if (padDecimals && decimalPart.length < decimals) {
                decimalPart = decimalPart.padEnd(decimals, '0');
            }

            // Додаємо розділювачі тисяч (оптимізовано)
            const integerFormatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, actualThousandsSeparator);

            // Повертаємо відформатоване число
            return decimals === 0 || !decimalPart ?
                integerFormatted :
                `${integerFormatted}${actualDecimalSeparator}${decimalPart}`;
        } catch (error) {
            return String(number);
        }
    }

    /**
     * Форматування дати для API
     * @param {Date|string|number} date - Дата для форматування
     * @param {Object} options - Параметри форматування
     * @returns {string} Відформатована дата
     */
    function formatDateForApi(date, options = {}) {
        const {
            format = apiFormatSettings.dateFormat,
            includeTime = true
        } = options;

        try {
            // Конвертуємо вхідне значення у Date
            const dateObj = parseDate(date);
            if (!dateObj || isNaN(dateObj.getTime())) {
                return null;
            }

            // ISO 8601 формат (найбільш універсальний)
            if (format === 'ISO') {
                return includeTime ? dateObj.toISOString() : dateObj.toISOString().split('T')[0];
            }

            // Власний формат (спрощена реалізація)
            const padZero = (num) => String(num).padStart(2, '0');

            const year = dateObj.getFullYear();
            const month = padZero(dateObj.getMonth() + 1);
            const day = padZero(dateObj.getDate());

            let result = `${year}-${month}-${day}`;

            if (includeTime) {
                const hours = padZero(dateObj.getHours());
                const minutes = padZero(dateObj.getMinutes());
                const seconds = padZero(dateObj.getSeconds());
                result += `T${hours}:${minutes}:${seconds}Z`;
            }

            return result;
        } catch (error) {
            return null;
        }
    }

    /**
     * Обробка дати з API
     * @param {string} apiDate - Дата з API
     * @param {Object} options - Параметри обробки
     * @returns {Date|null} Об'єкт Date або null
     */
    function parseApiDate(apiDate, options = {}) {
        const {
            adjustTimezone = true
        } = options;

        try {
            if (!apiDate) return null;

            // Створюємо об'єкт Date
            const dateObj = new Date(apiDate);

            // Перевіряємо валідність
            if (isNaN(dateObj.getTime())) {
                return null;
            }

            // Коригуємо часовий пояс, якщо потрібно
            if (adjustTimezone && apiFormatSettings.timeZoneHandling === 'utc') {
                // Перетворюємо UTC до локального часу
                const offset = new Date().getTimezoneOffset() * 60000;
                return new Date(dateObj.getTime() - offset);
            }

            return dateObj;
        } catch (error) {
            return null;
        }
    }

    /**
     * Форматування валюти
     * @param {number} amount - Сума
     * @param {string} currency - Код валюти
     * @param {Object} options - Опції форматування
     * @returns {string|number|Object} Відформатована валюта
     */
    function formatCurrency(amount, currency = 'UAH', options = {}) {
        const {
            locale = 'uk-UA',
            useSymbol = true,
            decimals = 2,
            forApi = false
        } = options;

        try {
            // Перевірка на NaN та Infinity
            if (!isFinite(amount)) {
                return String(amount);
            }

            // Для API
            if (forApi) {
                if (apiFormatSettings.currencyFormat === 'numeric') {
                    return formatNumber(amount, { decimals, forApi: true });
                } else {
                    return {
                        amount: formatNumber(amount, { decimals, forApi: true }),
                        currency: currency
                    };
                }
            }

            // Для UI використовуємо кешовані форматтери
            const key = `${locale}_${currency}_${useSymbol}_${decimals}`;

            if (!formattersCache[key] && typeof Intl !== 'undefined' && Intl.NumberFormat) {
                formattersCache[key] = new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: currency,
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                });
            }

            // Використовуємо кешований форматтер
            if (formattersCache[key]) {
                return formattersCache[key].format(amount);
            }

            // Запасний варіант
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
            return `${formattedNumber} ${symbol}`;
        } catch (error) {
            return `${amount} ${currency}`;
        }
    }

    /**
     * Підготовка даних для API
     * @param {Object} data - Дані для обробки
     * @param {Object} fieldDefs - Опис полів та їх типів
     * @returns {Object} Підготовлені дані
     */
    function prepareDataForApi(data, fieldDefs = {}) {
        try {
            if (!data || typeof data !== 'object') {
                return data;
            }

            const result = {};

            // Обробляємо кожне поле
            Object.keys(data).forEach(key => {
                const value = data[key];
                const fieldType = fieldDefs[key] || detectFieldType(value, key);

                switch (fieldType) {
                    case 'date':
                        result[key] = value ? formatDateForApi(value) : null;
                        break;

                    case 'timestamp':
                        // Перетворення дати в unix timestamp
                        if (value instanceof Date) {
                            result[key] = Math.floor(value.getTime() / 1000);
                        } else if (typeof value === 'string') {
                            const date = parseDate(value);
                            result[key] = date ? Math.floor(date.getTime() / 1000) : null;
                        } else {
                            result[key] = value;
                        }
                        break;

                    case 'number':
                        result[key] = formatNumber(value, { forApi: true });
                        break;

                    case 'currency':
                        result[key] = formatCurrency(value, data[`${key}_currency`] || 'WINIX', { forApi: true });
                        break;

                    case 'array':
                        if (Array.isArray(value)) {
                            result[key] = value.map(item =>
                                typeof item === 'object' ? prepareDataForApi(item) : item
                            );
                        } else {
                            result[key] = value;
                        }
                        break;

                    case 'object':
                        result[key] = prepareDataForApi(value);
                        break;

                    default:
                        result[key] = value;
                }
            });

            return result;
        } catch (error) {
            return data;
        }
    }

    /**
     * Обробка даних, отриманих з API
     * @param {Object} apiData - Дані з API
     * @param {Object} fieldDefs - Опис полів та їх типів
     * @returns {Object} Оброблені дані
     */
    function processApiResponse(apiData, fieldDefs = {}) {
        try {
            if (!apiData || typeof apiData !== 'object') {
                return apiData;
            }

            // Для масиву обробляємо кожен елемент
            if (Array.isArray(apiData)) {
                return apiData.map(item => processApiResponse(item, fieldDefs));
            }

            const result = {};

            // Обробляємо кожне поле
            Object.keys(apiData).forEach(key => {
                const value = apiData[key];
                const fieldType = fieldDefs[key] || detectFieldType(value, key);

                switch (fieldType) {
                    case 'date':
                    case 'datetime':
                        result[key] = value ? parseApiDate(value) : null;
                        break;

                    case 'timestamp':
                        if (typeof value === 'number' || !isNaN(parseInt(value))) {
                            const timestamp = typeof value === 'number' ? value : parseInt(value);
                            result[key] = new Date(timestamp * 1000);
                        } else {
                            result[key] = value;
                        }
                        break;

                    case 'number':
                        result[key] = typeof value === 'string' ? parseFloat(value) : value;
                        break;

                    case 'boolean':
                        if (typeof value === 'string') {
                            result[key] = value.toLowerCase() === 'true' || value === '1';
                        } else if (typeof value === 'number') {
                            result[key] = value === 1;
                        } else {
                            result[key] = Boolean(value);
                        }
                        break;

                    case 'array':
                        if (Array.isArray(value)) {
                            result[key] = value.map(item =>
                                typeof item === 'object' ? processApiResponse(item, fieldDefs) : item
                            );
                        } else {
                            result[key] = value;
                        }
                        break;

                    case 'object':
                        result[key] = processApiResponse(value, fieldDefs);
                        break;

                    default:
                        result[key] = value;
                }
            });

            return result;
        } catch (error) {
            return apiData;
        }
    }

    /**
     * Визначення типу поля на основі імені та значення
     * @param {any} value - Значення поля
     * @param {string} fieldName - Ім'я поля
     * @returns {string} Тип поля
     */
    function detectFieldType(value, fieldName) {
        // Оптимізований алгоритм визначення типу

        // Спочатку перевіряємо за типом значення
        if (value instanceof Date) {
            return 'date';
        }

        if (Array.isArray(value)) {
            return 'array';
        }

        if (value !== null && typeof value === 'object') {
            return 'object';
        }

        if (typeof value === 'number') {
            return 'number';
        }

        if (typeof value === 'boolean') {
            return 'boolean';
        }

        // Далі перевіряємо за іменем поля
        const nameLower = fieldName.toLowerCase();

        // Дата і час
        if (nameLower.includes('date') || nameLower.includes('time') || nameLower.endsWith('_at')) {
            return value && typeof value === 'number' && value > 1000000000 ? 'timestamp' : 'date';
        }

        // Фінансові показники
        if (nameLower.includes('price') || nameLower.includes('amount') ||
            nameLower.includes('cost') || nameLower.includes('balance')) {
            return 'currency';
        }

        // Числові показники
        if (nameLower.includes('count') || nameLower.includes('quantity') ||
            nameLower.includes('number') || (nameLower.includes('id') && !isNaN(value))) {
            return 'number';
        }

        // Булеві значення
        if (nameLower.startsWith('is_') || nameLower.startsWith('has_') ||
            nameLower.includes('enable') || nameLower.includes('active')) {
            return 'boolean';
        }

        return 'string';
    }

    /**
     * Перетворення різних форматів дати в об'єкт Date
     * @param {Date|string|number} date - Дата для парсингу
     * @returns {Date|null} Об'єкт Date або null
     */
    function parseDate(date) {
        if (!date) return null;

        // Якщо вже об'єкт Date
        if (date instanceof Date) {
            return new Date(date);
        }

        // Якщо число (timestamp)
        if (typeof date === 'number') {
            // Для Unix timestamp (секунди)
            if (date < 10000000000) {
                return new Date(date * 1000);
            }
            return new Date(date);
        }

        // Якщо рядок
        if (typeof date === 'string') {
            // ISO формат
            const isoDate = new Date(date);
            if (!isNaN(isoDate.getTime())) {
                return isoDate;
            }

            // Український формат дд.мм.рррр
            const uaMatch = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
            if (uaMatch) {
                const [_, day, month, year, hours = 0, minutes = 0, seconds = 0] = uaMatch;
                return new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hours),
                    parseInt(minutes),
                    parseInt(seconds)
                );
            }
        }

        return null;
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
            escapeHtml = true,
            stripTags = true
        } = options;

        try {
            if (!text) {
                return '';
            }

            let result = String(text);

            // Видаляємо HTML теги
            if (stripTags) {
                result = result.replace(/<[^>]+>/g, '');
            }

            // Екрануємо HTML
            if (escapeHtml) {
                result = result
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            // Обмежуємо довжину
            if (maxLength > 0 && result.length > maxLength) {
                if (preserveWords) {
                    // Знаходимо останнє слово, що вміщується
                    let cutIndex = maxLength;
                    while (cutIndex > 0 && result[cutIndex] !== ' ' && result[cutIndex] !== '\n') {
                        cutIndex--;
                    }

                    if (cutIndex > 0) {
                        result = result.substring(0, cutIndex) + ellipsis;
                    } else {
                        result = result.substring(0, maxLength) + ellipsis;
                    }
                } else {
                    result = result.substring(0, maxLength) + ellipsis;
                }
            }

            // Зберігаємо переноси рядків
            if (preserveLines) {
                result = result.replace(/\n/g, '<br>');
            }

            return result;
        } catch (error) {
            return String(text);
        }
    }

    /**
     * Налаштування API форматтера
     * @param {Object} settings - Об'єкт з налаштуваннями
     */
    function configureApiFormatter(settings = {}) {
        Object.assign(apiFormatSettings, settings);
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
        // Форматування українською
        number = Math.abs(number) % 100;
        const mod10 = number % 10;

        if (number >= 11 && number <= 19) {
            return many;
        }

        if (mod10 === 1) {
            return one;
        }

        if (mod10 >= 2 && mod10 <= 4) {
            return few;
        }

        return many;
    }

    // Публічний API
    return {
        // Базові форматтери
        formatNumber,
        formatCurrency,
        formatText,
        parseDate,
        pluralize,

        // API функції
        formatDateForApi,
        parseApiDate,
        prepareDataForApi,
        processApiResponse,
        configureApiFormatter,

        // Версія
        VERSION: "2.0.0"
    };
})();