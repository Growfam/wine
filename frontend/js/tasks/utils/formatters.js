/**
 * Formatters - вдосконалені утиліти для форматування різних типів даних
 * Відповідає за:
 * - Форматування чисел, дат, валют з урахуванням вимог API
 * - Перетворення даних між форматами фронтенду та бекенду
 * - Забезпечення узгодженості даних при передачі до API
 * - Валідацію даних перед відправкою
 */

window.Formatters = (function() {
    // Кеш форматтерів для оптимізації
    const formattersCache = {};

    // Налаштування для API
    const apiFormatSettings = {
        // Формати дат для API
        dateFormat: 'ISO', // 'ISO', 'RFC3339', 'custom'
        customDateFormat: 'yyyy-MM-dd',

        // Формат чисел для API
        decimalSeparator: '.',
        thousandsSeparator: '',

        // Налаштування валют для API
        currencyFormat: 'numeric', // 'numeric', 'code'

        // Формат даних для API
        preferNumbersAsStrings: false, // Деякі API віддають перевагу числам як рядкам
        timeZoneHandling: 'utc' // 'utc', 'local', 'offset'
    };

    /**
     * Форматування числа з розділювачами для відображення
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
            padDecimals = false,
            forApi = false // Прапорець для форматування для API
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
            const integerFormatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, actualThousandsSeparator);

            // Для API повертаємо число, якщо потрібно
            if (forApi && apiFormatSettings.preferNumbersAsStrings === false) {
                return rounded;
            }

            // Повертаємо число з розділювачем десяткових знаків
            return decimals === 0 || !decimalPart ?
                integerFormatted :
                `${integerFormatted}${actualDecimalSeparator}${decimalPart}`;
        } catch (error) {
            console.error('Помилка форматування числа:', error);
            return String(number);
        }
    }

    /**
     * Форматування дати у формат для API
     * @param {Date|string|number} date - Дата для форматування
     * @param {Object} options - Параметри форматування для API
     * @returns {string} Відформатована дата для API
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
                console.error('Неможливо обробити дату для API:', date);
                return null;
            }

            // ISO 8601 формат
            if (format === 'ISO') {
                return includeTime ? dateObj.toISOString() : dateObj.toISOString().split('T')[0];
            }

            // RFC 3339 формат
            if (format === 'RFC3339') {
                const isoString = dateObj.toISOString();
                return includeTime ? isoString.replace('Z', '+00:00') : isoString.split('T')[0];
            }

            // Власний формат
            if (format === 'custom') {
                const padZero = (num) => String(num).padStart(2, '0');

                const year = dateObj.getFullYear();
                const month = padZero(dateObj.getMonth() + 1);
                const day = padZero(dateObj.getDate());

                let result = apiFormatSettings.customDateFormat
                    .replace('yyyy', year)
                    .replace('MM', month)
                    .replace('dd', day);

                if (includeTime) {
                    const hours = padZero(dateObj.getHours());
                    const minutes = padZero(dateObj.getMinutes());
                    const seconds = padZero(dateObj.getSeconds());

                    result += ` ${hours}:${minutes}:${seconds}`;
                }

                return result;
            }

            // За замовчуванням - ISO 8601
            return includeTime ? dateObj.toISOString() : dateObj.toISOString().split('T')[0];
        } catch (error) {
            console.error('Помилка форматування дати для API:', error);
            return null;
        }
    }

    /**
     * Обробка дати з API та приведення до формату фронтенду
     * @param {string} apiDate - Дата з API
     * @param {Object} options - Параметри обробки
     * @returns {Date|null} Об'єкт Date або null
     */
    function parseApiDate(apiDate, options = {}) {
        const {
            format = apiFormatSettings.dateFormat,
            adjustTimezone = true
        } = options;

        try {
            if (!apiDate) return null;

            let dateObj;

            // ISO 8601 або RFC 3339 формат
            if (format === 'ISO' || format === 'RFC3339') {
                dateObj = new Date(apiDate);
            }
            // Власний формат
            else if (format === 'custom') {
                // Розділяємо дату і час, якщо вони є
                const parts = apiDate.split(' ');
                const dateParts = parts[0].split(/[-\/\.]/);

                if (dateParts.length !== 3) {
                    console.error('Неправильний формат дати:', apiDate);
                    return null;
                }

                // Розбираємо формат
                const formatParts = apiFormatSettings.customDateFormat.split(/[-\/\.]/);
                const yearIndex = formatParts.findIndex(part => part.includes('y'));
                const monthIndex = formatParts.findIndex(part => part.includes('M'));
                const dayIndex = formatParts.findIndex(part => part.includes('d'));

                // Створюємо об'єкт дати
                const year = parseInt(dateParts[yearIndex]);
                const month = parseInt(dateParts[monthIndex]) - 1; // Місяці від 0 до 11
                const day = parseInt(dateParts[dayIndex]);

                // Додаємо час, якщо він є
                if (parts.length > 1) {
                    const timeParts = parts[1].split(':');
                    const hours = parseInt(timeParts[0]);
                    const minutes = parseInt(timeParts[1]);
                    const seconds = timeParts.length > 2 ? parseInt(timeParts[2]) : 0;

                    dateObj = new Date(year, month, day, hours, minutes, seconds);
                } else {
                    dateObj = new Date(year, month, day);
                }
            }
            else {
                // Невідомий формат, пробуємо стандартний парсинг
                dateObj = new Date(apiDate);
            }

            // Перевіряємо валідність
            if (isNaN(dateObj.getTime())) {
                console.error('Результат парсингу дати невалідний:', apiDate);
                return null;
            }

            // Коригуємо часовий пояс, якщо потрібно
            if (adjustTimezone && apiFormatSettings.timeZoneHandling !== 'local') {
                if (apiFormatSettings.timeZoneHandling === 'utc') {
                    // Перетворюємо UTC до локального часу
                    const localDate = new Date();
                    const offset = localDate.getTimezoneOffset() * 60000; // в мілісекундах
                    dateObj = new Date(dateObj.getTime() - offset);
                }
            }

            return dateObj;
        } catch (error) {
            console.error('Помилка обробки дати з API:', error, apiDate);
            return null;
        }
    }

    /**
     * Форматування валюти
     * @param {number} amount - Сума
     * @param {string} currency - Код валюти
     * @param {Object} options - Опції форматування
     * @returns {string|number} Відформатована валюта
     */
    function formatCurrency(amount, currency = 'UAH', options = {}) {
        const {
            locale = 'uk-UA',
            useSymbol = true,
            symbolPosition = 'after', // 'before', 'after'
            decimals = 2,
            forApi = false // Прапорець для форматування для API
        } = options;

        try {
            // Перевірка на NaN та Infinity
            if (!isFinite(amount)) {
                return String(amount);
            }

            // Для API повертаємо числове значення за замовчуванням
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

            // Для UI використовуємо Intl.NumberFormat або запасний варіант
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
     * Конвертація даних для відправки в API
     * @param {Object} data - Дані для відправки
     * @param {Object} fieldDefs - Опис полів та їх типів
     * @returns {Object} Підготовлені дані для API
     */
    function prepareDataForApi(data, fieldDefs = {}) {
        try {
            if (!data || typeof data !== 'object') {
                return data;
            }

            const result = {};

            // Обробляємо кожне поле залежно від його типу
            Object.keys(data).forEach(key => {
                const value = data[key];
                const fieldType = fieldDefs[key] || detectFieldType(value, key);

                switch (fieldType) {
                    case 'date':
                        result[key] = value ? formatDateForApi(value) : null;
                        break;

                    case 'timestamp':
                        // Перетворюємо дату в unix timestamp, якщо потрібно
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

                    case 'boolean':
                        // API може очікувати boolean як 0/1 або true/false
                        result[key] = value;
                        break;

                    default:
                        result[key] = value;
                }
            });

            return result;
        } catch (error) {
            console.error('Помилка підготовки даних для API:', error);
            return data; // Повертаємо оригінальні дані у випадку помилки
        }
    }

    /**
     * Аналіз даних, отриманих з API
     * @param {Object} apiData - Дані, отримані з API
     * @param {Object} fieldDefs - Опис полів та їх типів
     * @returns {Object} Оброблені дані для використання у фронтенді
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
                        // Конвертуємо рядок дати в об'єкт Date
                        result[key] = value ? parseApiDate(value) : null;
                        break;

                    case 'timestamp':
                        // Конвертуємо unix timestamp в дату
                        if (typeof value === 'number' || !isNaN(parseInt(value))) {
                            const timestamp = typeof value === 'number' ? value : parseInt(value);
                            result[key] = new Date(timestamp * 1000);
                        } else {
                            result[key] = value;
                        }
                        break;

                    case 'number':
                        // Переконуємося, що числа прийшли як числа
                        result[key] = typeof value === 'string' ? parseFloat(value) : value;
                        break;

                    case 'boolean':
                        // Обробляємо різні формати boolean (0/1, "true"/"false", тощо)
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
            console.error('Помилка обробки відповіді API:', error);
            return apiData; // Повертаємо оригінальні дані у випадку помилки
        }
    }

    /**
     * Визначення типу поля на основі імені та значення
     * @param {any} value - Значення поля
     * @param {string} fieldName - Ім'я поля
     * @returns {string} Тип поля
     */
    function detectFieldType(value, fieldName) {
        // За іменем поля
        const nameLower = fieldName.toLowerCase();

        if (nameLower.includes('date') || nameLower.includes('time') || nameLower.endsWith('_at')) {
            return value && typeof value === 'number' && value > 1000000000 ? 'timestamp' : 'date';
        }

        if (nameLower.includes('price') || nameLower.includes('amount') ||
            nameLower.includes('cost') || nameLower.includes('balance')) {
            return 'currency';
        }

        if (nameLower.includes('count') || nameLower.includes('quantity') ||
            nameLower.includes('number') || nameLower.includes('id') && !isNaN(value)) {
            return 'number';
        }

        if (nameLower.includes('is_') || nameLower.includes('has_') ||
            nameLower.includes('enable') || nameLower.includes('active')) {
            return 'boolean';
        }

        // За типом значення
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

        return 'string';
    }

    /**
     * Перетворення різних форматів дати в об'єкт Date
     * @param {Date|string|number} date - Дата для парсингу
     * @returns {Date|null} Об'єкт Date або null
     */
    function parseDate(date) {
        if (!date) return null;

        if (date instanceof Date) {
            return new Date(date);
        }

        if (typeof date === 'string') {
            // ISO формат (найбільша ймовірність розпізнавання)
            if (date.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/)) {
                return new Date(date);
            }

            // Український формат дд.мм.рррр
            const uaDateMatch = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
            if (uaDateMatch) {
                const [_, day, month, year, hours = 0, minutes = 0, seconds = 0] = uaDateMatch;
                return new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hours),
                    parseInt(minutes),
                    parseInt(seconds)
                );
            }

            // Європейський формат дд/мм/рррр
            const euDateMatch = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
            if (euDateMatch) {
                const [_, day, month, year, hours = 0, minutes = 0, seconds = 0] = euDateMatch;
                return new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hours),
                    parseInt(minutes),
                    parseInt(seconds)
                );
            }

            // Американський формат мм/дд/рррр
            const usDateMatch = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
            if (usDateMatch) {
                // Увага! Тут порядок місяця і дня відрізняється
                const [_, month, day, year, hours = 0, minutes = 0, seconds = 0] = usDateMatch;
                return new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hours),
                    parseInt(minutes),
                    parseInt(seconds)
                );
            }

            // Якщо жоден формат не підійшов, спробуємо стандартний парсинг
            const fallbackDate = new Date(date);
            return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
        }

        if (typeof date === 'number') {
            // Якщо це Unix timestamp (секунди, а не мілісекунди)
            if (date < 10000000000) { // Якщо менше 10 млрд, то це ймовірно unix timestamp
                return new Date(date * 1000);
            }
            return new Date(date);
        }

        return null;
    }

    /**
     * Форматування тексту для відображення в HTML з додатковими перевірками безпеки
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
            stripTags = true,
            allowedTags = [] // дозволені теги, якщо stripTags = true
        } = options;

        try {
            if (!text) {
                return '';
            }

            let result = String(text);

            // Видаляємо зайві HTML теги для безпеки, якщо потрібно
            if (stripTags) {
                // Якщо є дозволені теги, забезпечимо їх збереження
                if (allowedTags && allowedTags.length) {
                    // Створюємо регулярний вираз для видалення всіх тегів, крім дозволених
                    const allowedTagsPattern = allowedTags.map(tag => `${tag}|/${tag}`).join('|');
                    const tagsRegex = new RegExp(`<(?!(?:${allowedTagsPattern})\\b)[^>]+>`, 'gi');
                    result = result.replace(tagsRegex, '');
                } else {
                    // Видаляємо всі теги
                    result = result.replace(/<[^>]+>/g, '');
                }
            }

            // Екрануємо HTML, якщо потрібно (після видалення тегів)
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
     * Валідація даних перед відправкою до API
     * @param {Object} data - Дані для валідації
     * @param {Object} schema - Схема валідації з правилами для полів
     * @returns {Object} Результат валідації {valid, errors}
     */
    function validateApiData(data, schema) {
        const result = {
            valid: true,
            errors: {}
        };

        try {
            if (!data || !schema || typeof data !== 'object' || typeof schema !== 'object') {
                result.valid = false;
                result.errors._global = ['Невалідні дані або схема'];
                return result;
            }

            // Проходимо по всім полям схеми
            Object.keys(schema).forEach(field => {
                const rules = schema[field];
                const value = data[field];

                // Перевіряємо обов'язковість
                if (rules.required && (value === undefined || value === null || value === '')) {
                    result.valid = false;
                    result.errors[field] = result.errors[field] || [];
                    result.errors[field].push(`Поле ${field} обов'язкове`);
                    return; // Пропускаємо інші перевірки для цього поля
                }

                // Якщо поле відсутнє і необов'язкове, пропускаємо
                if (value === undefined || value === null) {
                    return;
                }

                // Перевіряємо тип
                if (rules.type) {
                    const typeValid = checkTypeValidity(value, rules.type);
                    if (!typeValid) {
                        result.valid = false;
                        result.errors[field] = result.errors[field] || [];
                        result.errors[field].push(`Поле ${field} має бути типу ${rules.type}`);
                    }
                }

                // Перевіряємо мінімальну та максимальну довжину
                if (rules.minLength !== undefined && String(value).length < rules.minLength) {
                    result.valid = false;
                    result.errors[field] = result.errors[field] || [];
                    result.errors[field].push(`Мінімальна довжина поля ${field} - ${rules.minLength}`);
                }

                if (rules.maxLength !== undefined && String(value).length > rules.maxLength) {
                    result.valid = false;
                    result.errors[field] = result.errors[field] || [];
                    result.errors[field].push(`Максимальна довжина поля ${field} - ${rules.maxLength}`);
                }

                // Перевіряємо мінімальне та максимальне значення для чисел
                if (rules.min !== undefined && rules.type === 'number' && value < rules.min) {
                    result.valid = false;
                    result.errors[field] = result.errors[field] || [];
                    result.errors[field].push(`Мінімальне значення поля ${field} - ${rules.min}`);
                }

                if (rules.max !== undefined && rules.type === 'number' && value > rules.max) {
                    result.valid = false;
                    result.errors[field] = result.errors[field] || [];
                    result.errors[field].push(`Максимальне значення поля ${field} - ${rules.max}`);
                }

                // Перевіряємо відповідність регулярному виразу
                if (rules.pattern && !new RegExp(rules.pattern).test(String(value))) {
                    result.valid = false;
                    result.errors[field] = result.errors[field] || [];
                    result.errors[field].push(`Поле ${field} не відповідає формату`);
                }

                // Перевіряємо через додаткову функцію валідації
                if (typeof rules.validate === 'function') {
                    const validateResult = rules.validate(value, data);
                    if (validateResult !== true) {
                        result.valid = false;
                        result.errors[field] = result.errors[field] || [];
                        result.errors[field].push(validateResult || `Поле ${field} невалідне`);
                    }
                }
            });

            return result;
        } catch (error) {
            console.error('Помилка валідації даних для API:', error);
            result.valid = false;
            result.errors._global = ['Виникла помилка при валідації даних'];
            return result;
        }
    }

    /**
     * Перевірка типу значення
     * @param {any} value - Значення для перевірки
     * @param {string} type - Очікуваний тип
     * @returns {boolean} Результат перевірки
     */
    function checkTypeValidity(value, type) {
        switch (type) {
            case 'string':
                return typeof value === 'string';

            case 'number':
                return typeof value === 'number' && !isNaN(value);

            case 'boolean':
                return typeof value === 'boolean';

            case 'array':
                return Array.isArray(value);

            case 'object':
                return typeof value === 'object' && !Array.isArray(value) && value !== null;

            case 'date':
                return value instanceof Date && !isNaN(value.getTime());

            case 'email':
                return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

            case 'url':
                try {
                    new URL(value);
                    return true;
                } catch (e) {
                    return false;
                }

            default:
                return true;
        }
    }

    /**
     * Налаштування API форматтера
     * @param {Object} settings - Об'єкт з налаштуваннями
     */
    function configureApiFormatter(settings = {}) {
        Object.assign(apiFormatSettings, settings);
        console.log('Formatters: Налаштування API форматтера оновлено', apiFormatSettings);
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

    // Інформація про версію та автора
    const VERSION = "1.2.0";
    const AUTHOR = "WINIX Team";

    // Ініціалізація модуля
    console.log(`Formatters v${VERSION} initialized`);

    // Публічний API
    return {
        // Базові функції форматування
        formatNumber,
        formatCurrency,
        formatText,
        parseDate,
        pluralize,

        // Розширені функції для API
        formatDateForApi,
        parseApiDate,
        prepareDataForApi,
        processApiResponse,
        validateApiData,

        // Налаштування
        configureApiFormatter,

        // Інформація про модуль
        VERSION,
        AUTHOR
    };
})();