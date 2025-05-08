/**
 * Модуль форматування часу та дат
 *
 * Відповідає за:
 * - Різні формати відображення дат і часу
 * - Локалізоване форматування
 * - Відносний формат часу
 * - Склонення слів залежно від чисел
 *
 * @version 1.0.0
 */

import { getLogger } from '../core/index.js';
import { parseDate } from './date.js';

// Створюємо логер для модуля
const logger = getLogger('TimeFormat');

/**
 * Форматування дати у людино-зрозумілий рядок
 * @param {Date|string|number} date - Дата для форматування
 * @param {string} format - Формат (short, medium, long, time, datetime, relative)
 * @param {Object} options - Додаткові опції
 * @returns {string} Відформатований рядок дати
 */
export function formatDate(date, format = 'medium', options = {}) {
  try {
    // Конвертуємо вхідне значення у Date
    const dateObj = parseDate(date);
    if (!dateObj) return 'Невірна дата';

    const {
      locale = 'uk-UA', // Локаль за замовчуванням
    } = options;

    // Функція для додавання нуля перед числом
    const padZero = (num) => String(num).padStart(2, '0');

    // Форматування відповідно до обраного формату
    switch (format) {
      case 'short':
        return `${padZero(dateObj.getDate())}.${padZero(dateObj.getMonth() + 1)}.${dateObj.getFullYear()}`;

      case 'time':
        return `${padZero(dateObj.getHours())}:${padZero(dateObj.getMinutes())}`;

      case 'datetime':
        return `${padZero(dateObj.getDate())}.${padZero(dateObj.getMonth() + 1)}.${dateObj.getFullYear()} ${padZero(dateObj.getHours())}:${padZero(dateObj.getMinutes())}`;

      case 'relative':
        return getRelativeTimeString(dateObj, options);

      case 'long':
        try {
          return dateObj.toLocaleDateString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        } catch (e) {
          // Запасний варіант, якщо toLocaleDateString недоступний
          const months = [
            'січня',
            'лютого',
            'березня',
            'квітня',
            'травня',
            'червня',
            'липня',
            'серпня',
            'вересня',
            'жовтня',
            'листопада',
            'грудня',
          ];
          return `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()} р.`;
        }

      case 'medium':
      default:
        try {
          return dateObj.toLocaleDateString(locale);
        } catch (e) {
          // Запасний варіант
          return `${padZero(dateObj.getDate())}.${padZero(dateObj.getMonth() + 1)}.${dateObj.getFullYear()}`;
        }
    }
  } catch (error) {
    logger.error('Помилка форматування дати', 'formatDate', {
      error: error.message,
    });
    return 'Помилка дати';
  }
}

/**
 * Отримання відносного часу у зручному форматі
 * @param {Date} date - Дата для порівняння
 * @param {Object} options - Додаткові опції
 * @returns {string} Відносний час
 */
export function getRelativeTimeString(date, options = {}) {
  try {
    const {
      locale = 'uk-UA', // Локаль за замовчуванням
      now = new Date(), // Поточна дата для порівняння
    } = options;

    // Конвертуємо вхідні дати в об'єкти Date
    const dateObj = parseDate(date);
    const nowObj = parseDate(now);

    if (!dateObj || !nowObj) {
      return 'Невірна дата';
    }

    // Різниця в мілісекундах
    const diffMs = nowObj - dateObj;

    // Конвертуємо різницю в секунди
    const diffSec = Math.floor(diffMs / 1000);

    // Функція для форматування часу з використанням Intl.RelativeTimeFormat
    try {
      const rtf = new Intl.RelativeTimeFormat(locale, {
        numeric: 'auto',
        style: options.style || 'long',
      });

      // В майбутньому
      if (diffSec < 0) {
        const absDiff = Math.abs(diffSec);

        if (absDiff < 60) {
          return rtf.format(Math.ceil(-absDiff), 'second');
        } else if (absDiff < 3600) {
          return rtf.format(Math.ceil(-absDiff / 60), 'minute');
        } else if (absDiff < 86400) {
          return rtf.format(Math.ceil(-absDiff / 3600), 'hour');
        } else if (absDiff < 604800) {
          return rtf.format(Math.ceil(-absDiff / 86400), 'day');
        } else if (absDiff < 2592000) {
          return rtf.format(Math.ceil(-absDiff / 604800), 'week');
        } else if (absDiff < 31536000) {
          return rtf.format(Math.ceil(-absDiff / 2592000), 'month');
        } else {
          return rtf.format(Math.ceil(-absDiff / 31536000), 'year');
        }
      }

      // В минулому
      if (diffSec < 60) {
        return rtf.format(-Math.floor(diffSec), 'second');
      } else if (diffSec < 3600) {
        return rtf.format(-Math.floor(diffSec / 60), 'minute');
      } else if (diffSec < 86400) {
        return rtf.format(-Math.floor(diffSec / 3600), 'hour');
      } else if (diffSec < 604800) {
        return rtf.format(-Math.floor(diffSec / 86400), 'day');
      } else if (diffSec < 2592000) {
        return rtf.format(-Math.floor(diffSec / 604800), 'week');
      } else if (diffSec < 31536000) {
        return rtf.format(-Math.floor(diffSec / 2592000), 'month');
      } else {
        return rtf.format(-Math.floor(diffSec / 31536000), 'year');
      }
    } catch (formatError) {
      // Запасний варіант для браузерів без підтримки RelativeTimeFormat

      // В майбутньому
      if (diffSec < 0) {
        const absDiff = Math.abs(diffSec);

        if (absDiff < 60) {
          return 'через кілька секунд';
        } else if (absDiff < 3600) {
          const minutes = Math.floor(absDiff / 60);
          return `через ${minutes} ${pluralize(minutes, 'хвилину', 'хвилини', 'хвилин')}`;
        } else if (absDiff < 86400) {
          const hours = Math.floor(absDiff / 3600);
          return `через ${hours} ${pluralize(hours, 'годину', 'години', 'годин')}`;
        } else if (absDiff < 604800) {
          const days = Math.floor(absDiff / 86400);
          return `через ${days} ${pluralize(days, 'день', 'дні', 'днів')}`;
        } else {
          return formatDate(dateObj, 'short');
        }
      }

      // В минулому
      if (diffSec < 60) {
        return 'щойно';
      } else if (diffSec < 3600) {
        const minutes = Math.floor(diffSec / 60);
        return `${minutes} ${pluralize(minutes, 'хвилину', 'хвилини', 'хвилин')} тому`;
      } else if (diffSec < 86400) {
        const hours = Math.floor(diffSec / 3600);
        return `${hours} ${pluralize(hours, 'годину', 'години', 'годин')} тому`;
      } else if (diffSec < 604800) {
        const days = Math.floor(diffSec / 86400);
        return `${days} ${pluralize(days, 'день', 'дні', 'днів')} тому`;
      } else if (diffSec < 2592000) {
        const weeks = Math.floor(diffSec / 604800);
        return `${weeks} ${pluralize(weeks, 'тиждень', 'тижні', 'тижнів')} тому`;
      } else if (diffSec < 31536000) {
        const months = Math.floor(diffSec / 2592000);
        return `${months} ${pluralize(months, 'місяць', 'місяці', 'місяців')} тому`;
      } else {
        const years = Math.floor(diffSec / 31536000);
        return `${years} ${pluralize(years, 'рік', 'роки', 'років')} тому`;
      }
    }
  } catch (error) {
    logger.error('Помилка отримання відносного часу', 'getRelativeTimeString', {
      error: error.message,
    });
    return 'Помилка обчислення часу';
  }
}

/**
 * Склонення слова залежно від числа
 * @param {number} n - Число
 * @param {string} form1 - Форма для 1
 * @param {string} form2 - Форма для 2-4
 * @param {string} form5 - Форма для 5-9, 0
 * @returns {string} Правильна форма слова
 */
export function pluralize(n, form1, form2, form5) {
  try {
    n = Math.abs(n) % 100;
    const n1 = n % 10;

    if (n > 10 && n < 20) return form5;
    if (n1 > 1 && n1 < 5) return form2;
    if (n1 === 1) return form1;

    return form5;
  } catch (error) {
    logger.error('Помилка склонення слова', 'pluralize', {
      n,
      error: error.message,
    });
    return form5; // Повертаємо форму за замовчуванням
  }
}

/**
 * Форматування залишку часу
 * @param {number} timeLeft - Залишок часу в мс
 * @param {string} format - Формат відображення (short, medium, full)
 * @param {Object} options - Додаткові опції
 * @returns {string} Відформатований час
 */
export function formatTimeLeft(timeLeft, format = 'short', options = {}) {
  try {
    if (timeLeft <= 0) {
      return options.expiredText || 'Закінчено';
    }

    // Обчислюємо компоненти часу
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    // Функція для додавання нуля перед числом
    const padZero = (num) => (options.padZero ? String(num).padStart(2, '0') : num);

    // Короткий формат
    if (format === 'short') {
      if (days > 0) {
        return `${days}д ${padZero(hours)}г`;
      } else if (hours > 0) {
        return `${hours}г ${padZero(minutes)}хв`;
      } else {
        return `${minutes}хв ${padZero(seconds)}с`;
      }
    }

    // Середній формат (HH:MM:SS)
    if (format === 'medium') {
      if (days > 0) {
        return `${days}:${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
      } else {
        return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
      }
    }

    // Повний формат
    const parts = [];

    if (days > 0) {
      parts.push(`${days} ${pluralize(days, 'день', 'дні', 'днів')}`);
    }

    if (hours > 0 || days > 0) {
      parts.push(`${hours} ${pluralize(hours, 'година', 'години', 'годин')}`);
    }

    if (minutes > 0 || hours > 0 || days > 0) {
      parts.push(`${minutes} ${pluralize(minutes, 'хвилина', 'хвилини', 'хвилин')}`);
    }

    parts.push(`${seconds} ${pluralize(seconds, 'секунда', 'секунди', 'секунд')}`);

    return parts.join(' ');
  } catch (error) {
    logger.error('Помилка форматування залишку часу', 'formatTimeLeft', {
      error: error.message,
    });
    return 'Помилка обчислення часу';
  }
}

/**
 * Форматування тривалості
 * @param {number} duration - Тривалість у мілісекундах
 * @param {Object} options - Опції форматування
 * @returns {string} Відформатована тривалість
 */
export function formatDuration(duration, options = {}) {
  try {
    const {
      format = 'short', // Формат (short, medium, full)
      showZeroValues = false, // Показувати нульові значення
      maxParts = 0, // Максимальна кількість частин (0 - без обмеження)
    } = options;

    if (duration <= 0) {
      return options.zeroText || (format === 'short' ? '0c' : '0 секунд');
    }

    // Обчислюємо компоненти часу
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    const ms = Math.floor(duration % 1000);

    // Короткий формат
    if (format === 'short') {
      const parts = [];

      if (days > 0 || (days === 0 && showZeroValues)) parts.push(`${days}д`);
      if (hours > 0 || (hours === 0 && showZeroValues)) parts.push(`${hours}г`);
      if (minutes > 0 || (minutes === 0 && showZeroValues)) parts.push(`${minutes}хв`);
      if (seconds > 0 || (seconds === 0 && showZeroValues)) parts.push(`${seconds}с`);
      if ((ms > 0 || (ms === 0 && showZeroValues)) && format === 'full') parts.push(`${ms}мс`);

      // Обмежуємо кількість частин, якщо вказано
      if (maxParts > 0 && parts.length > maxParts) {
        parts.length = maxParts;
      }

      return parts.join(' ');
    }

    // Середній формат (HH:MM:SS)
    if (format === 'medium') {
      const padZero = (num) => String(num).padStart(2, '0');

      if (days > 0) {
        return `${days}:${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
      } else {
        return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
      }
    }

    // Повний формат
    const parts = [];

    if (days > 0 || (days === 0 && showZeroValues)) {
      parts.push(`${days} ${pluralize(days, 'день', 'дні', 'днів')}`);
    }

    if (hours > 0 || (hours === 0 && showZeroValues)) {
      parts.push(`${hours} ${pluralize(hours, 'година', 'години', 'годин')}`);
    }

    if (minutes > 0 || (minutes === 0 && showZeroValues)) {
      parts.push(`${minutes} ${pluralize(minutes, 'хвилина', 'хвилини', 'хвилин')}`);
    }

    if (seconds > 0 || (seconds === 0 && showZeroValues)) {
      parts.push(`${seconds} ${pluralize(seconds, 'секунда', 'секунди', 'секунд')}`);
    }

    if ((ms > 0 || (ms === 0 && showZeroValues)) && format === 'full') {
      parts.push(`${ms} ${pluralize(ms, 'мілісекунда', 'мілісекунди', 'мілісекунд')}`);
    }

    // Обмежуємо кількість частин, якщо вказано
    if (maxParts > 0 && parts.length > maxParts) {
      parts.length = maxParts;
    }

    return parts.join(' ');
  } catch (error) {
    logger.error('Помилка форматування тривалості', 'formatDuration', {
      error: error.message,
    });
    return 'Помилка форматування';
  }
}

/**
 * Перетворення ISO 8601 тривалості у мілісекунди
 * @param {string} isoDuration - Рядок тривалості у форматі ISO 8601
 * @returns {number} Тривалість у мілісекундах
 */
export function parseIsoDuration(isoDuration) {
  try {
    if (!isoDuration || typeof isoDuration !== 'string') {
      return 0;
    }

    // Регулярний вираз для аналізу ISO 8601 тривалості
    const regex =
      /P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?/;
    const matches = isoDuration.match(regex);

    if (!matches) {
      return 0;
    }

    // Отримуємо компоненти
    const years = parseInt(matches[1] || 0);
    const months = parseInt(matches[2] || 0);
    const days = parseInt(matches[3] || 0);
    const hours = parseInt(matches[4] || 0);
    const minutes = parseInt(matches[5] || 0);
    const seconds = parseFloat(matches[6] || 0);

    // Перетворюємо у мілісекунди (приблизно)
    return (
      years * 365 * 24 * 60 * 60 * 1000 +
      months * 30 * 24 * 60 * 60 * 1000 +
      days * 24 * 60 * 60 * 1000 +
      hours * 60 * 60 * 1000 +
      minutes * 60 * 1000 +
      seconds * 1000
    );
  } catch (error) {
    logger.error('Помилка парсингу ISO тривалості', 'parseIsoDuration', {
      isoDuration,
      error: error.message,
    });
    return 0;
  }
}

/**
 * Перетворення мілісекунд у ISO 8601 тривалість
 * @param {number} ms - Тривалість у мілісекундах
 * @param {Object} options - Опції форматування
 * @returns {string} Рядок тривалості у форматі ISO 8601
 */
export function formatIsoDuration(ms, options = {}) {
  try {
    const {
      includeZero = false, // Включати нульові значення
      precision = 0, // Точність для секунд (кількість десяткових знаків)
    } = options;

    if (ms <= 0) {
      return 'PT0S';
    }

    // Обчислюємо компоненти часу
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = ((ms % (1000 * 60)) / 1000).toFixed(precision);

    let result = 'P';

    // Додаємо дні
    if (days > 0 || (days === 0 && includeZero)) {
      result += `${days}D`;
    }

    // Додаємо час
    if (hours > 0 || minutes > 0 || seconds > 0 || includeZero) {
      result += 'T';

      if (hours > 0 || (hours === 0 && includeZero)) {
        result += `${hours}H`;
      }

      if (minutes > 0 || (minutes === 0 && includeZero)) {
        result += `${minutes}M`;
      }

      // Додаємо секунди з десятковими знаками, якщо потрібно
      if (precision > 0) {
        if (parseFloat(seconds) > 0 || (parseFloat(seconds) === 0 && includeZero)) {
          result += `${seconds}S`;
        }
      } else {
        if (Math.floor(seconds) > 0 || (Math.floor(seconds) === 0 && includeZero)) {
          result += `${Math.floor(seconds)}S`;
        }
      }
    }

    return result;
  } catch (error) {
    logger.error('Помилка форматування ISO тривалості', 'formatIsoDuration', {
      ms,
      error: error.message,
    });
    return 'PT0S';
  }
}

// Експорт основних функцій
export default {
  formatDate,
  getRelativeTimeString,
  pluralize,
  formatTimeLeft,
  formatDuration,
  parseIsoDuration,
  formatIsoDuration,
};
