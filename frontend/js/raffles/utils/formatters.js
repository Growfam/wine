/**
 * formatters.js - Оптимізовані утилітарні функції для форматування даних
 * - Додано кешування результатів
 * - Покращена обробка помилок та невалідних даних
 * - Оптимізовані алгоритми
 * - Додано нові корисні форматери
 */

import WinixRaffles from '../globals.js';
import cacheAPI from './cache.js';

// Формати дати
const dateTimeFormat = new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
});

const dateOnlyFormat = new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
});

const timeOnlyFormat = new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit'
});

// Локальний об'єкт для мікрокешування (для швидкого доступу)
const _microCache = {
    date: new Map(),
    number: new Map(),
    timeLeft: new Map(),
    currency: new Map(),
    places: new Map()
};

// Максимальний розмір мікрокешу для кожного типу
const MAX_MICROCACHE_SIZE = 100;

/**
 * Очищення мікрокешу, якщо він став занадто великим
 * @param {string} cacheType - Тип кешу для очищення
 * @private
 */
function _cleanupMicroCache(cacheType) {
    if (_microCache[cacheType] && _microCache[cacheType].size > MAX_MICROCACHE_SIZE) {
        // Створюємо новий Map з останніх 50 елементів
        const entries = Array.from(_microCache[cacheType].entries()).slice(-50);
        _microCache[cacheType] = new Map(entries);
    }
}

/**
 * Допоміжна функція для правильного відмінювання слів
 * @param {number} count - Кількість
 * @param {string} one - Форма слова для 1
 * @param {string} few - Форма слова для 2-4
 * @param {string} many - Форма слова для 5-20
 * @returns {string} Правильна форма слова
 * @private
 */
function _pluralize(count, one, few, many) {
    const absCount = Math.abs(count);
    const mod10 = absCount % 10;
    const mod100 = absCount % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return one;
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
        return few;
    }
    return many;
}

/**
 * Форматування дати у зручний для відображення формат
 * @param {string|Date} timestamp - Відмітка часу або об'єкт Date
 * @param {string} format - Формат дати ('full', 'date', 'time')
 * @param {boolean} useCache - Використовувати кеш
 * @returns {string} Відформатована дата
 */
export function formatDate(timestamp, format = 'full', useCache = true) {
    if (!timestamp) return '';

    // Генеруємо ключ для кешу
    const cacheKey = `${timestamp}_${format}`;

    // Перевіряємо мікрокеш
    if (useCache && _microCache.date.has(cacheKey)) {
        return _microCache.date.get(cacheKey);
    }

    // Перевіряємо локальний кеш, якщо мікрокеш не містить результату
    if (useCache) {
        const cachedResult = cacheAPI.get(cacheAPI.types.GLOBAL, `format_date_${cacheKey}`);
        if (cachedResult) {
            // Зберігаємо в мікрокеш для майбутнього швидкого доступу
            _microCache.date.set(cacheKey, cachedResult);
            return cachedResult;
        }
    }

    try {
        let date;
        if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }

        if (isNaN(date.getTime())) {
            if (WinixRaffles.logger) {
                WinixRaffles.logger.warn("Невалідна дата:", timestamp);
            } else {
                console.warn("Невалідна дата:", timestamp);
            }
            return '';
        }

        let result;
        switch (format) {
            case 'date':
                result = dateOnlyFormat.format(date);
                break;
            case 'time':
                result = timeOnlyFormat.format(date);
                break;
            case 'full':
            default:
                result = dateTimeFormat.format(date);
                break;
        }

        // Зберігаємо результат у кеші
        if (useCache) {
            // Зберігаємо в мікрокеш
            _microCache.date.set(cacheKey, result);
            _cleanupMicroCache('date');

            // Зберігаємо в локальний кеш на 1 день
            cacheAPI.set(cacheAPI.types.GLOBAL, `format_date_${cacheKey}`, result, 24 * 60 * 60 * 1000);
        }

        return result;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка форматування дати:', error);
        } else {
            console.error('Помилка форматування дати:', error);
        }
        return '';
    }
}

/**
 * Форматування відносного часу (наприклад, "5 хвилин тому", "вчора")
 * @param {string|Date} timestamp - Відмітка часу або об'єкт Date
 * @param {boolean} useCache - Використовувати кеш
 * @returns {string} Відформатований відносний час
 */
export function formatRelativeTime(timestamp, useCache = true) {
    if (!timestamp) return '';

    try {
        let date;
        if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }

        if (isNaN(date.getTime())) {
            if (WinixRaffles.logger) {
                WinixRaffles.logger.warn("Невалідна дата для відносного часу:", timestamp);
            } else {
                console.warn("Невалідна дата для відносного часу:", timestamp);
            }
            return '';
        }

        // Генеруємо ключ для кешу, округлюючи час до хвилини для економії
        // В кеші зберігаємо відносний час від початку поточної хвилини
        const now = new Date();
        const diffMs = now - date;

        // Відносний час не має сенсу кешувати для дуже свіжих дат (менше 1 хвилини)
        // або для дуже старих (більше тижня)
        if (diffMs < 60000 || diffMs > 7 * 24 * 60 * 60 * 1000) {
            useCache = false;
        }

        // Створюємо ключ кешу, округлюючи до хвилини
        const nowMinutes = Math.floor(now.getTime() / 60000);
        const dateMinutes = Math.floor(date.getTime() / 60000);
        const minutesDiff = nowMinutes - dateMinutes;
        const cacheKey = `rel_${minutesDiff}`;

        // Перевіряємо кеш
        if (useCache && _microCache.relativeTime && _microCache.relativeTime.has(cacheKey)) {
            return _microCache.relativeTime.get(cacheKey);
        }

        // Розрахунок відносного часу
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        let result;
        if (diffSec < 60) {
            result = 'щойно';
        } else if (diffMin < 60) {
            result = `${diffMin} ${_pluralize(diffMin, 'хвилину', 'хвилини', 'хвилин')} тому`;
        } else if (diffHour < 24) {
            result = `${diffHour} ${_pluralize(diffHour, 'годину', 'години', 'годин')} тому`;
        } else if (diffDay === 1) {
            result = 'вчора';
        } else if (diffDay < 7) {
            result = `${diffDay} ${_pluralize(diffDay, 'день', 'дні', 'днів')} тому`;
        } else {
            // Для більше тижня просто показуємо дату
            result = dateOnlyFormat.format(date);
        }

        // Зберігаємо результат у кеш, якщо він має сенс
        if (useCache && _microCache.relativeTime) {
            _microCache.relativeTime.set(cacheKey, result);
            if (!_microCache.relativeTime.size) {
                _microCache.relativeTime = new Map();
            }
            if (_microCache.relativeTime.size > MAX_MICROCACHE_SIZE) {
                _cleanupMicroCache('relativeTime');
            }
        }

        return result;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка форматування відносного часу:', error);
        } else {
            console.error('Помилка форматування відносного часу:', error);
        }
        return '';
    }
}

/**
 * Форматування валюти
 * @param {number} amount - Сума
 * @param {string} currency - Валюта (за замовчуванням 'WINIX')
 * @param {Object} options - Додаткові опції форматування
 * @returns {string} Відформатована сума з валютою
 */
export function formatCurrency(amount, currency = 'WINIX', options = {}) {
    try {
        // Перевіряємо, що amount є числом
        const numAmount = Number(amount);
        if (isNaN(numAmount)) {
            return '0 ' + currency;
        }

        // Ключ кешу
        const cacheKey = `${numAmount}_${currency}_${JSON.stringify(options)}`;

        // Перевіряємо мікрокеш
        if (_microCache.currency.has(cacheKey)) {
            return _microCache.currency.get(cacheKey);
        }

        // Визначаємо кількість десяткових знаків
        const isInteger = Number.isInteger(numAmount);
        const isLargeNumber = Math.abs(numAmount) > 1000;

        const defaultOptions = {
            maximumFractionDigits: (isInteger || isLargeNumber) ? 0 : 2,
            minimumFractionDigits: 0,
            useGrouping: true
        };

        // Об'єднуємо опції
        const mergedOptions = { ...defaultOptions, ...options };

        // Форматуємо число
        const formatter = new Intl.NumberFormat('uk-UA', mergedOptions);
        const formattedNumber = formatter.format(numAmount);

        // Створюємо результат з валютою
        let result;
        if (options.currencyPosition === 'before') {
            result = `${currency} ${formattedNumber}`;
        } else {
            result = `${formattedNumber} ${currency}`;
        }

        // Зберігаємо результат у мікрокеш
        _microCache.currency.set(cacheKey, result);
        _cleanupMicroCache('currency');

        return result;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка форматування валюти:', error);
        } else {
            console.error('Помилка форматування валюти:', error);
        }
        return '0 ' + currency;
    }
}

/**
 * Форматування числа з використанням роздільників
 * @param {number} num - Число для форматування
 * @param {Object} options - Додаткові опції форматування
 * @returns {string} Відформатоване число
 */
export function formatNumber(num, options = {}) {
    try {
        // Перевіряємо, що num є числом
        const number = Number(num);
        if (isNaN(number)) {
            return '0';
        }

        // Ключ кешу
        const cacheKey = `${number}_${JSON.stringify(options)}`;

        // Перевіряємо мікрокеш
        if (_microCache.number.has(cacheKey)) {
            return _microCache.number.get(cacheKey);
        }

        // Опції за замовчуванням
        const defaultOptions = {
            minimumFractionDigits: 0,
            maximumFractionDigits: Number.isInteger(number) ? 0 : 2,
            useGrouping: true
        };

        // Об'єднуємо опції
        const mergedOptions = { ...defaultOptions, ...options };

        // Форматуємо число
        const formatter = new Intl.NumberFormat('uk-UA', mergedOptions);
        const result = formatter.format(number);

        // Зберігаємо результат у мікрокеш
        _microCache.number.set(cacheKey, result);
        _cleanupMicroCache('number');

        return result;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка форматування числа:', error);
        } else {
            console.error('Помилка форматування числа:', error);
        }
        return '0';
    }
}

/**
 * Форматування числа для читабельного відображення файлових розмірів
 * @param {number} bytes - Кількість байтів
 * @param {boolean} binary - Використовувати бінарні префікси (KiB, MiB) замість десяткових (KB, MB)
 * @returns {string} Відформатований розмір файлу
 */
export function formatFileSize(bytes, binary = false) {
    try {
        const number = Number(bytes);
        if (isNaN(number) || number < 0) {
            return '0 байт';
        }

        const base = binary ? 1024 : 1000;
        const units = binary
            ? ['байт', 'КіБ', 'МіБ', 'ГіБ', 'ТіБ', 'ПіБ']
            : ['байт', 'КБ', 'МБ', 'ГБ', 'ТБ', 'ПБ'];

        if (number === 0) return '0 байт';

        const exponent = Math.min(Math.floor(Math.log(number) / Math.log(base)), units.length - 1);
        const value = number / Math.pow(base, exponent);
        const formattedValue = formatNumber(value, {
            maximumFractionDigits: exponent === 0 ? 0 : 2,
            minimumFractionDigits: 0
        });

        return `${formattedValue} ${units[exponent]}`;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка форматування розміру файлу:', error);
        } else {
            console.error('Помилка форматування розміру файлу:', error);
        }
        return '0 байт';
    }
}

/**
 * Додавання ведучого нуля до числа (для годин, хвилин тощо)
 * @param {number} num - Число для форматування
 * @returns {string} Число з ведучим нулем (якщо потрібно)
 */
export function padZero(num) {
    try {
        // Перевіряємо, що num є числом
        const number = Number(num);
        if (isNaN(number)) {
            return '00';
        }

        // Оптимізоване рішення для чисел від 0 до 99
        if (number >= 0 && number < 100) {
            return number < 10 ? `0${number}` : `${number}`;
        }

        // Для більших чисел використовуємо стандартний padStart
        return number.toString().padStart(2, '0');
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка додавання ведучого нуля:', error);
        } else {
            console.error('Помилка додавання ведучого нуля:', error);
        }
        return '00';
    }
}

/**
 * Форматування списку місць для відображення
 * @param {Array<number>} places - Список місць
 * @returns {string} Відформатований текст місць
 */
export function formatPlaces(places) {
    try {
        if (!places || !Array.isArray(places) || places.length === 0) {
            return "Невідомо";
        }

        // Створюємо ключ кешу на основі вмісту масиву
        const cacheKey = places.join(',');

        // Перевіряємо мікрокеш
        if (_microCache.places.has(cacheKey)) {
            return _microCache.places.get(cacheKey);
        }

        // Фільтруємо невалідні значення і конвертуємо все до чисел
        const validPlaces = places
            .filter(place => !isNaN(Number(place)))
            .map(place => Number(place))
            .sort((a, b) => a - b);

        if (validPlaces.length === 0) {
            return "Невідомо";
        }

        if (validPlaces.length === 1) {
            const result = `${validPlaces[0]} місце`;
            _microCache.places.set(cacheKey, result);
            return result;
        }

        // Оптимізований алгоритм пошуку послідовностей
        const ranges = [];
        let start = validPlaces[0];
        let end = validPlaces[0];

        for (let i = 1; i < validPlaces.length; i++) {
            if (validPlaces[i] === end + 1) {
                // Продовжуємо поточний діапазон
                end = validPlaces[i];
            } else {
                // Завершуємо поточний діапазон і починаємо новий
                if (start === end) {
                    ranges.push(`${start}`);
                } else {
                    ranges.push(`${start}-${end}`);
                }
                start = end = validPlaces[i];
            }
        }

        // Додаємо останній діапазон
        if (start === end) {
            ranges.push(`${start}`);
        } else {
            ranges.push(`${start}-${end}`);
        }

        const result = ranges.join(', ') + ' місця';

        // Зберігаємо результат у мікрокеш
        _microCache.places.set(cacheKey, result);
        _cleanupMicroCache('places');

        return result;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка форматування місць:', error);
        } else {
            console.error('Помилка форматування місць:', error);
        }
        return "Невідомо";
    }
}

/**
 * Форматування часу, що залишився (для таймерів)
 * @param {number} timeLeftMs - Час у мілісекундах
 * @param {string} format - Формат ('short', 'full', 'compact')
 * @returns {Object} Об'єкт з відформатованими значеннями
 */
export function formatTimeLeft(timeLeftMs, format = 'full') {
    try {
        // Перевіряємо вхідні дані
        const timeLeft = Number(timeLeftMs);

        if (isNaN(timeLeft) || timeLeft <= 0) {
            return {
                days: '00',
                hours: '00',
                minutes: '00',
                seconds: '00',
                text: 'Завершено'
            };
        }

        // Ключ кешу з округленням до секунди для економії пам'яті
        const roundedTimeLeft = Math.floor(timeLeft / 1000) * 1000;
        const cacheKey = `${roundedTimeLeft}_${format}`;

        // Перевіряємо мікрокеш
        if (_microCache.timeLeft.has(cacheKey)) {
            return _microCache.timeLeft.get(cacheKey);
        }

        // Розрахунок компонентів часу
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        // Форматування тексту в залежності від формату
        let text = '';
        if (format === 'short') {
            if (days > 0) {
                text = `${days}д ${hours}г`;
            } else {
                text = `${hours}г ${minutes}хв`;
            }
        } else if (format === 'compact') {
            if (days > 0) {
                text = `${days}д ${hours}г ${minutes}хв`;
            } else if (hours > 0) {
                text = `${hours}:${padZero(minutes)}:${padZero(seconds)}`;
            } else {
                text = `${minutes}:${padZero(seconds)}`;
            }
        } else {
            if (days > 0) {
                text = `${days} ${_pluralize(days, 'день', 'дні', 'днів')} ${padZero(hours)}:${padZero(minutes)}`;
            } else {
                text = `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
            }
        }

        const result = {
            days: padZero(days),
            hours: padZero(hours),
            minutes: padZero(minutes),
            seconds: padZero(seconds),
            text
        };

        // Зберігаємо результат у мікрокеш
        _microCache.timeLeft.set(cacheKey, result);
        _cleanupMicroCache('timeLeft');

        return result;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка форматування часу:', error);
        } else {
            console.error('Помилка форматування часу:', error);
        }
        return {
            days: '00',
            hours: '00',
            minutes: '00',
            seconds: '00',
            text: 'Помилка'
        };
    }
}

/**
 * Аналіз та форматування часу з різних форматів вводу
 * @param {string|number|Date} timeInput - Вхідні дані часу (текст, timestamp, об'єкт Date)
 * @returns {Object} Об'єкт з проаналізованими даними часу
 */
export function parseTime(timeInput) {
    try {
        let date;

        // Обробка різних типів вхідних даних
        if (timeInput instanceof Date) {
            date = timeInput;
        } else if (typeof timeInput === 'number') {
            // Якщо число завелике для мілісекунд, вважаємо що це секунди
            date = new Date(timeInput > 9999999999 ? timeInput : timeInput * 1000);
        } else if (typeof timeInput === 'string') {
            // Спроба розпізнати рядок як дату
            if (/^\d+$/.test(timeInput)) {
                // Якщо рядок містить тільки цифри, вважаємо його timestamp
                const num = parseInt(timeInput, 10);
                date = new Date(num > 9999999999 ? num : num * 1000);
            } else {
                // Інакше пробуємо парсити як рядок дати
                date = new Date(timeInput);
            }
        } else {
            throw new Error('Непідтримуваний формат часу');
        }

        if (isNaN(date.getTime())) {
            throw new Error('Невалідний формат часу');
        }

        // Формуємо результат
        return {
            date: date,
            iso: date.toISOString(),
            timestamp: date.getTime(),
            unix: Math.floor(date.getTime() / 1000),
            formatted: {
                date: dateOnlyFormat.format(date),
                time: timeOnlyFormat.format(date),
                full: dateTimeFormat.format(date)
            },
            components: {
                year: date.getFullYear(),
                month: date.getMonth() + 1,
                day: date.getDate(),
                hours: date.getHours(),
                minutes: date.getMinutes(),
                seconds: date.getSeconds()
            }
        };
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка парсингу часу:', error);
        } else {
            console.error('Помилка парсингу часу:', error);
        }
        return null;
    }
}

/**
 * Розрахунок прогресу за часом
 * @param {Date|string} startTime - Час початку
 * @param {Date|string} endTime - Час завершення
 * @returns {number} Відсоток прогресу (0-100)
 */
export function calculateProgressByTime(startTime, endTime) {
    try {
        if (!startTime || !endTime) {
            return 0;
        }

        // Перетворюємо дати у timestamp
        let start, end;

        if (startTime instanceof Date) {
            start = startTime.getTime();
        } else {
            const startDate = new Date(startTime);
            if (isNaN(startDate.getTime())) {
                if (WinixRaffles.logger) {
                    WinixRaffles.logger.warn('Невалідна дата початку:', startTime);
                } else {
                    console.warn('Невалідна дата початку:', startTime);
                }
                return 0;
            }
            start = startDate.getTime();
        }

        if (endTime instanceof Date) {
            end = endTime.getTime();
        } else {
            const endDate = new Date(endTime);
            if (isNaN(endDate.getTime())) {
                if (WinixRaffles.logger) {
                    WinixRaffles.logger.warn('Невалідна дата завершення:', endTime);
                } else {
                    console.warn('Невалідна дата завершення:', endTime);
                }
                return 0;
            }
            end = endDate.getTime();
        }

        // Перевіряємо логіку дат
        if (end <= start) {
            if (WinixRaffles.logger) {
                WinixRaffles.logger.warn('Дата завершення повинна бути пізніше за дату початку');
            } else {
                console.warn('Дата завершення повинна бути пізніше за дату початку');
            }
            return 0;
        }

        const now = Date.now();
        const totalDuration = end - start;

        // Перевіряємо на валідність тривалості
        if (totalDuration <= 0) {
            return 0;
        }

        // Розраховуємо скільки часу пройшло
        const elapsed = now - start;

        // Обмежуємо прогрес від 0 до 100%
        if (elapsed <= 0) return 0;
        if (elapsed >= totalDuration) return 100;

        const progress = (elapsed / totalDuration) * 100;

        // Округляємо до цілого числа
        return Math.round(progress);
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error("Помилка розрахунку прогресу:", error);
        } else {
            console.error("Помилка розрахунку прогресу:", error);
        }
        return 0;
    }
}

/**
 * Генерація HTML для розподілу призів
 * @param {Object} prizeDistribution - Об'єкт з розподілом призів
 * @returns {string} - HTML-розмітка
 */
export function generatePrizeDistributionHTML(prizeDistribution) {
    try {
        // Перевіряємо вхідні дані
        if (!prizeDistribution || typeof prizeDistribution !== 'object') {
            return '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
        }

        // Перевіряємо, чи є хоч якісь дані
        const keys = Object.keys(prizeDistribution);
        if (keys.length === 0) {
            return '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
        }

        // Створюємо масив місць з валідними числовими ключами
        const places = keys
            .filter(key => !isNaN(parseInt(key)))
            .map(key => parseInt(key))
            .sort((a, b) => a - b);

        if (places.length === 0) {
            return '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
        }

        // Групуємо місця з однаковими призами (оптимізований алгоритм)
        const groupedPrizes = new Map();

        places.forEach(place => {
            const prize = prizeDistribution[place];
            if (!prize) return;

            // Перевіряємо, що prize має валідний формат
            const amount = prize.amount !== undefined ? prize.amount :
                           (typeof prize === 'number' ? prize : 0);
            const currency = prize.currency || 'WINIX';

            if (amount === 0) return;

            const key = `${amount}-${currency}`;

            if (!groupedPrizes.has(key)) {
                groupedPrizes.set(key, {
                    amount,
                    currency,
                    places: []
                });
            }

            groupedPrizes.get(key).places.push(place);
        });

        // Якщо нема валідних призів
        if (groupedPrizes.size === 0) {
            return '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
        }

        // Створюємо HTML для кожної групи призів
        let html = '';
        groupedPrizes.forEach(group => {
            const placesText = formatPlaces(group.places);
            html += `
                <div class="prize-item">
                    <span class="prize-place">${placesText}:</span>
                    <span class="prize-value">${group.amount} ${group.currency}</span>
                </div>
            `;
        });

        return html;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка генерації HTML для розподілу призів:', error);
        } else {
            console.error('Помилка генерації HTML для розподілу призів:', error);
        }
        return '<div class="prize-item"><span class="prize-place">Помилка відображення</span></div>';
    }
}

/**
 * Перевірка, чи закінчився час до кінцевої дати
 * @param {string|Date} endDate - Кінцева дата
 * @returns {boolean} - true, якщо час закінчився, false - якщо ще залишився
 */
export function isTimeOver(endDate) {
    try {
        if (!endDate) return true;

        let end;
        if (endDate instanceof Date) {
            end = endDate;
        } else {
            end = new Date(endDate);
        }

        if (isNaN(end.getTime())) {
            return true;
        }

        const now = new Date();
        return now >= end;
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка перевірки закінчення часу:', error);
        } else {
            console.error('Помилка перевірки закінчення часу:', error);
        }
        return true;
    }
}

/**
 * Форматування номера телефону у міжнародному форматі
 * @param {string} phoneNumber - Номер телефону
 * @returns {string} - Відформатований номер телефону
 */
export function formatPhoneNumber(phoneNumber) {
    try {
        if (!phoneNumber) return '';

        // Видаляємо всі нецифрові символи
        const digits = phoneNumber.replace(/\D/g, '');

        // Перевіряємо чи достатньо цифр
        if (digits.length < 10) return phoneNumber;

        // Визначаємо код країни
        let countryCode, nationalNumber;

        if (digits.startsWith('380') && digits.length >= 12) {
            // Український формат
            countryCode = '+380';
            nationalNumber = digits.substring(3);
        } else if (digits.startsWith('7') && digits.length >= 11) {
            // Російський формат
            countryCode = '+7';
            nationalNumber = digits.substring(1);
        } else if (digits.length === 10) {
            // Припускаємо, що це український номер без коду країни
            countryCode = '+380';
            nationalNumber = digits;
        } else if (digits.length === 11 && digits.startsWith('8')) {
            // СНД формат з 8 на початку
            countryCode = '+7';
            nationalNumber = digits.substring(1);
        } else {
            // Інший формат
            countryCode = '+' + digits.substring(0, 3);
            nationalNumber = digits.substring(3);
        }

        // Форматуємо номер
        if (countryCode === '+380') {
            // Український формат: +380 67 123 4567
            return `${countryCode} ${nationalNumber.substring(0, 2)} ${nationalNumber.substring(2, 5)} ${nationalNumber.substring(5)}`;
        } else if (countryCode === '+7') {
            // Російський формат: +7 999 123-45-67
            return `${countryCode} ${nationalNumber.substring(0, 3)} ${nationalNumber.substring(3, 6)}-${nationalNumber.substring(6, 8)}-${nationalNumber.substring(8)}`;
        } else {
            // Загальний формат
            return `${countryCode} ${nationalNumber}`;
        }
    } catch (error) {
        if (WinixRaffles.logger) {
            WinixRaffles.logger.error('Помилка форматування номера телефону:', error);
        } else {
            console.error('Помилка форматування номера телефону:', error);
        }
        return phoneNumber;
    }
}

// Ініціалізація модуля
function initFormatters() {
    // Ініціалізуємо порожні мікрокеші для всіх типів, які використовуються
    if (!_microCache.relativeTime) {
        _microCache.relativeTime = new Map();
    }

    // Логуємо успішну ініціалізацію
    if (WinixRaffles.logger) {
        WinixRaffles.logger.log("Форматери: Модуль успішно ініціалізовано");
    } else {
        console.log("🎮 WINIX Raffles: Ініціалізація утиліт форматування");
    }
}

// Додаємо форматери в глобальний об'єкт для зворотної сумісності
if (WinixRaffles && WinixRaffles.utils) {
    WinixRaffles.utils.formatters = {
        formatDate,
        formatRelativeTime,
        formatCurrency,
        formatNumber,
        formatFileSize,
        padZero,
        formatPlaces,
        formatTimeLeft,
        parseTime,
        calculateProgressByTime,
        generatePrizeDistributionHTML,
        isTimeOver,
        formatPhoneNumber
    };

    // Для зручного доступу додаємо форматери до utils
    Object.assign(WinixRaffles.utils, WinixRaffles.utils.formatters);
}

// Викликаємо ініціалізацію
initFormatters();

// Експортуємо всі функції
export default {
    formatDate,
    formatRelativeTime,
    formatCurrency,
    formatNumber,
    formatFileSize,
    padZero,
    formatPlaces,
    formatTimeLeft,
    parseTime,
    calculateProgressByTime,
    generatePrizeDistributionHTML,
    isTimeOver,
    formatPhoneNumber
};