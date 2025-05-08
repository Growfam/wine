/**
 * Модуль для роботи з датами
 *
 * Відповідає за:
 * - Обробку та парсинг дат у різних форматах
 * - Перевірку дат на валідність
 * - Конвертацію між форматами дат
 * - Роботу з часовими поясами
 *
 * @version 1.0.0
 */

import { getLogger } from '../core';

// Створюємо логер для модуля
const logger = getLogger('TimeDate');

// Конфігурація за замовчуванням
const config = {
  adjustForTimezone: true, // Коригувати відображення за часовим поясом
  apiDateFormat: 'ISO', // Формат дати для API (ISO, yyyy-mm-dd)
  timeZoneHandling: 'utc', // Обробка часових поясів (utc, local)
};

/**
 * Перетворення різних форматів дати в об'єкт Date
 * @param {Date|string|number} date - Дата для парсингу
 * @returns {Date|null} Об'єкт Date або null
 */
export function parseDate(date) {
  if (!date) return null;

  try {
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
      const uaMatch = date.match(
        /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
      );
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

      // Американський формат мм/дд/рррр
      const usMatch = date.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
      );
      if (usMatch) {
        const [_, month, day, year, hours = 0, minutes = 0, seconds = 0] = usMatch;
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
  } catch (error) {
    logger.error('Помилка парсингу дати', 'parseDate', {
      date,
      error: error.message,
    });
    return null;
  }
}

/**
 * Перевірка, чи дата є коректною
 * @param {number} year - Рік
 * @param {number} month - Місяць (1-12)
 * @param {number} day - День
 * @returns {boolean} Результат перевірки
 */
export function isValidDate(year, month, day) {
  try {
    // Перевіряємо межі
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }

    // Перевіряємо кількість днів у місяці
    const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= daysInMonth[month - 1];
  } catch (error) {
    logger.error('Помилка перевірки дати', 'isValidDate', {
      year,
      month,
      day,
      error: error.message,
    });
    return false;
  }
}

/**
 * Перевірка високосного року
 * @param {number} year - Рік
 * @returns {boolean} Високосний рік чи ні
 */
export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Форматування дати для API
 * @param {Date|string|number} date - Дата для форматування
 * @param {Object} options - Параметри форматування
 * @returns {string} Відформатована дата для API
 */
export function formatDateForApi(date, options = {}) {
  const { format = config.apiDateFormat, includeTime = true } = options;

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
    logger.error('Помилка форматування дати для API', 'formatDateForApi', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Обробка дати з API
 * @param {string} apiDate - Дата з API
 * @param {Object} options - Параметри обробки
 * @returns {Date|null} Об'єкт Date або null
 */
export function parseApiDate(apiDate, options = {}) {
  const { adjustTimezone = true } = options;

  try {
    if (!apiDate) return null;

    // Створюємо об'єкт Date
    const dateObj = new Date(apiDate);

    // Перевіряємо валідність
    if (isNaN(dateObj.getTime())) {
      return null;
    }

    // Коригуємо часовий пояс, якщо потрібно
    if (adjustTimezone && config.timeZoneHandling === 'utc') {
      // Перетворюємо UTC до локального часу
      const offset = new Date().getTimezoneOffset() * 60000;
      return new Date(dateObj.getTime() - offset);
    }

    return dateObj;
  } catch (error) {
    logger.error('Помилка парсингу дати з API', 'parseApiDate', {
      apiDate,
      error: error.message,
    });
    return null;
  }
}

/**
 * Отримання відносної різниці між двома датами
 * @param {Date|string|number} date1 - Перша дата
 * @param {Date|string|number} date2 - Друга дата (за замовчуванням - поточна)
 * @returns {Object} Об'єкт з різницею у роках, місяцях, днях, годинах, хвилинах, секундах
 */
export function getDateDifference(date1, date2 = new Date()) {
  try {
    const d1 = parseDate(date1);
    const d2 = parseDate(date2);

    if (!d1 || !d2) {
      return null;
    }

    // Різниця в мілісекундах
    const diff = Math.abs(d2 - d1);

    // Обчислюємо різницю
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    // Обчислюємо роки, місяці та дні
    let years = 0;
    let months = 0;
    let remainingDays = days;

    // Обчислюємо кількість років
    const date1Year = d1.getFullYear();
    const date2Year = d2.getFullYear();
    years = date2Year - date1Year;

    // Коригуємо роки, якщо місяць/день дати 1 більший
    if (
      d1.getMonth() > d2.getMonth() ||
      (d1.getMonth() === d2.getMonth() && d1.getDate() > d2.getDate())
    ) {
      years--;
    }

    // Обчислюємо кількість місяців
    let month1 = d1.getMonth();
    let month2 = d2.getMonth();

    if (month2 < month1) {
      month2 += 12;
    }

    months = month2 - month1;

    // Коригуємо місяці, якщо день дати 1 більший
    if (d1.getDate() > d2.getDate()) {
      months--;
    }

    // Якщо місяці від'ємні, коригуємо
    if (months < 0) {
      months += 12;
    }

    // Залишкові дні, години, хвилини, секунди
    const secondsInDay = 24 * 60 * 60;
    const remainingSeconds = seconds % secondsInDay;
    const remainingMinutes = minutes % 60;
    const remainingHours = hours % 24;

    // Повертаємо різницю у зручному форматі
    return {
      years,
      months,
      days: remainingDays,
      hours: remainingHours,
      minutes: remainingMinutes,
      seconds: remainingSeconds % 60,
      totalDays: days,
      totalHours: hours,
      totalMinutes: minutes,
      totalSeconds: seconds,
      milliseconds: diff,
    };
  } catch (error) {
    logger.error('Помилка обчислення різниці дат', 'getDateDifference', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Додавання часового періоду до дати
 * @param {Date|string|number} date - Вихідна дата
 * @param {Object} period - Об'єкт з періодом (роки, місяці, дні, години, хвилини, секунди)
 * @returns {Date} Нова дата
 */
export function addPeriod(date, period = {}) {
  try {
    const { years = 0, months = 0, days = 0, hours = 0, minutes = 0, seconds = 0 } = period;

    const dateObj = parseDate(date);
    if (!dateObj) {
      return null;
    }

    // Додаємо період
    if (years) dateObj.setFullYear(dateObj.getFullYear() + years);
    if (months) dateObj.setMonth(dateObj.getMonth() + months);
    if (days) dateObj.setDate(dateObj.getDate() + days);
    if (hours) dateObj.setHours(dateObj.getHours() + hours);
    if (minutes) dateObj.setMinutes(dateObj.getMinutes() + minutes);
    if (seconds) dateObj.setSeconds(dateObj.getSeconds() + seconds);

    return dateObj;
  } catch (error) {
    logger.error('Помилка додавання періоду до дати', 'addPeriod', {
      date,
      period,
      error: error.message,
    });
    return null;
  }
}

/**
 * Віднімання часового періоду від дати
 * @param {Date|string|number} date - Вихідна дата
 * @param {Object} period - Об'єкт з періодом (роки, місяці, дні, години, хвилини, секунди)
 * @returns {Date} Нова дата
 */
export function subtractPeriod(date, period = {}) {
  // Створюємо від'ємний період
  const negativePeriod = {};

  Object.keys(period).forEach((key) => {
    negativePeriod[key] = -period[key];
  });

  // Використовуємо функцію addPeriod з від'ємними значеннями
  return addPeriod(date, negativePeriod);
}

/**
 * Визначення часового поясу користувача
 * @returns {Object} Інформація про часовий пояс
 */
export function getUserTimezone() {
  try {
    const now = new Date();
    const offsetMinutes = now.getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
    const offsetMinutesRemainder = Math.abs(offsetMinutes % 60);

    // Формуємо назву часового поясу
    const sign = offsetMinutes <= 0 ? '+' : '-';
    const offsetString = `UTC${sign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutesRemainder.toString().padStart(2, '0')}`;

    // Дізнаємося назву часового поясу, якщо підтримується
    let timezoneName = '';
    try {
      timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      // Ігноруємо помилку
    }

    return {
      offsetMinutes,
      offsetHours: offsetMinutes / 60,
      offsetString,
      timezoneName,
    };
  } catch (error) {
    logger.error('Помилка визначення часового поясу', 'getUserTimezone', {
      error: error.message,
    });
    return {
      offsetMinutes: 0,
      offsetHours: 0,
      offsetString: 'UTC+00:00',
      timezoneName: '',
    };
  }
}

/**
 * Оновлення налаштувань модуля
 * @param {Object} newConfig - Нові налаштування
 * @returns {Object} Поточні налаштування
 */
export function updateConfig(newConfig = {}) {
  Object.assign(config, newConfig);
  logger.debug('Оновлено налаштування', 'updateConfig', { newConfig });
  return { ...config };
}

/**
 * Перевірка, чи дата входить в заданий інтервал
 * @param {Date|string|number} date - Дата для перевірки
 * @param {Date|string|number} startDate - Початкова дата інтервалу
 * @param {Date|string|number} endDate - Кінцева дата інтервалу
 * @param {boolean} inclusive - Чи включати межі інтервалу
 * @returns {boolean} Результат перевірки
 */
export function isDateInRange(date, startDate, endDate, inclusive = true) {
  try {
    const dateObj = parseDate(date);
    const startObj = parseDate(startDate);
    const endObj = parseDate(endDate);

    if (!dateObj || !startObj || !endObj) {
      return false;
    }

    if (inclusive) {
      return dateObj >= startObj && dateObj <= endObj;
    } else {
      return dateObj > startObj && dateObj < endObj;
    }
  } catch (error) {
    logger.error('Помилка перевірки діапазону дат', 'isDateInRange', {
      error: error.message,
    });
    return false;
  }
}

/**
 * Отримання першого/останнього дня місяця
 * @param {Date|string|number} date - Дата для обробки
 * @param {string} type - Тип дати ('first' або 'last')
 * @returns {Date} Результат
 */
export function getMonthDay(date, type = 'first') {
  try {
    const dateObj = parseDate(date);
    if (!dateObj) {
      return null;
    }

    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();

    if (type === 'first') {
      return new Date(year, month, 1);
    } else if (type === 'last') {
      return new Date(year, month + 1, 0);
    }

    return null;
  } catch (error) {
    logger.error('Помилка отримання дня місяця', 'getMonthDay', {
      date,
      type,
      error: error.message,
    });
    return null;
  }
}

// Експорт основних функцій та конфігурацій
export default {
  parseDate,
  isValidDate,
  isLeapYear,
  formatDateForApi,
  parseApiDate,
  getDateDifference,
  addPeriod,
  subtractPeriod,
  getUserTimezone,
  updateConfig,
  isDateInRange,
  getMonthDay,

  // Експортуємо конфігурацію як readonly
  get config() {
    return { ...config };
  },
};
