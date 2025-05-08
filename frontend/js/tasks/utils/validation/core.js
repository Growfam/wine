/**
 * Базовий модуль валідації даних
 *
 * Відповідає за:
 * - Основні функції валідації
 * - Управління валідаторами
 * - Загальну логіку перевірки даних
 *
 * @version 1.0.0
 */

import { getLogger } from '../core/index.js';

// Створюємо логер для модуля
const logger = getLogger('ValidationCore');

// Кеш для регулярних виразів - для підвищення продуктивності
const regexCache = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
  url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
  number: /^-?\d*\.?\d+$/,
  integer: /^-?\d+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  username: /^[a-zA-Z0-9_-]{3,20}$/,
};

// Конфігурація за замовчуванням
const config = {
  customErrorMessages: true, // Використовувати користувацькі повідомлення про помилки
};

/**
 * Валідація рядка за регулярним виразом
 * @param {string} value - Значення для перевірки
 * @param {RegExp|string} regex - Регулярний вираз або ключ з regexCache
 * @param {string} [errorMessage] - Користувацьке повідомлення про помилку
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validatePattern(value, regex, errorMessage) {
  try {
    let pattern;

    // Якщо regex - це ключ з regexCache
    if (typeof regex === 'string' && regexCache[regex]) {
      pattern = regexCache[regex];
    }
    // Якщо regex - це рядок, створюємо з нього RegExp
    else if (typeof regex === 'string') {
      pattern = new RegExp(regex);
    }
    // Якщо regex - це вже RegExp
    else if (regex instanceof RegExp) {
      pattern = regex;
    }
    // За замовчуванням
    else {
      return {
        isValid: false,
        errorMessage: 'Невірний формат регулярного виразу',
      };
    }

    const isValid = pattern.test(String(value));

    return {
      isValid,
      errorMessage: isValid ? '' : errorMessage || 'Значення не відповідає шаблону',
    };
  } catch (error) {
    logger.error('Помилка валідації за шаблоном', 'validatePattern', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація обов'язкового поля
 * @param {*} value - Значення для перевірки
 * @param {string} [errorMessage] - Користувацьке повідомлення про помилку
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateRequired(value, errorMessage) {
  try {
    // Перевіряємо, щоб значення не було undefined, null, порожнім рядком або false
    const isValid = value !== undefined && value !== null && value !== '' && value !== false;

    return {
      isValid,
      errorMessage: isValid ? '' : errorMessage || "Це поле обов'язкове для заповнення",
    };
  } catch (error) {
    logger.error("Помилка валідації обов'язкового поля", 'validateRequired', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація довжини рядка
 * @param {string} value - Значення для перевірки
 * @param {number} minLength - Мінімальна довжина
 * @param {number} maxLength - Максимальна довжина
 * @param {string} [errorMessage] - Користувацьке повідомлення про помилку
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateLength(value, minLength, maxLength, errorMessage) {
  try {
    const strValue = String(value);
    const length = strValue.length;

    let isValid = true;
    let message = '';

    // Перевіряємо мінімальну довжину, якщо вказана
    if (minLength !== undefined && minLength > 0 && length < minLength) {
      isValid = false;
      message = `Текст повинен містити щонайменше ${minLength} символів`;
    }
    // Перевіряємо максимальну довжину, якщо вказана
    else if (maxLength !== undefined && maxLength > 0 && length > maxLength) {
      isValid = false;
      message = `Текст повинен містити не більше ${maxLength} символів`;
    }

    return {
      isValid,
      errorMessage: isValid ? '' : errorMessage || message,
    };
  } catch (error) {
    logger.error('Помилка валідації довжини', 'validateLength', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація електронної пошти
 * @param {string} value - Значення для перевірки
 * @param {string} [errorMessage] - Користувацьке повідомлення про помилку
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateEmail(value, errorMessage) {
  return validatePattern(
    value,
    regexCache.email,
    errorMessage || 'Введіть коректну електронну адресу'
  );
}

/**
 * Валідація телефонного номера
 * @param {string} value - Значення для перевірки
 * @param {string} [errorMessage] - Користувацьке повідомлення про помилку
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validatePhone(value, errorMessage) {
  try {
    // Видаляємо всі нецифрові символи для валідації
    const cleanValue = String(value).replace(/\D/g, '');

    // Перевіряємо довжину та формат
    const isValid = cleanValue.length >= 10 && regexCache.phone.test(value);

    return {
      isValid,
      errorMessage: isValid ? '' : errorMessage || 'Введіть коректний номер телефону',
    };
  } catch (error) {
    logger.error('Помилка валідації телефону', 'validatePhone', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація URL
 * @param {string} value - Значення для перевірки
 * @param {string} [errorMessage] - Користувацьке повідомлення про помилку
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateUrl(value, errorMessage) {
  return validatePattern(value, regexCache.url, errorMessage || 'Введіть коректний URL');
}

/**
 * Валідація числа
 * @param {string|number} value - Значення для перевірки
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateNumber(value, options = {}) {
  try {
    const {
      min, // Мінімальне значення
      max, // Максимальне значення
      integer = false, // Чи має бути цілим числом
      errorMessage, // Користувацьке повідомлення про помилку
      minMessage, // Повідомлення про помилку мінімального значення
      maxMessage, // Повідомлення про помилку максимального значення
    } = options;

    // Перевіряємо, чи значення є числом
    const isNumber = integer
      ? regexCache.integer.test(String(value))
      : regexCache.number.test(String(value));

    if (!isNumber) {
      return {
        isValid: false,
        errorMessage: errorMessage || (integer ? 'Введіть ціле число' : 'Введіть числове значення'),
      };
    }

    // Конвертуємо в число
    const numValue = parseFloat(value);

    // Перевіряємо мінімальне та максимальне значення
    if (min !== undefined && numValue < min) {
      return {
        isValid: false,
        errorMessage: minMessage || `Значення повинно бути не менше ${min}`,
      };
    }

    if (max !== undefined && numValue > max) {
      return {
        isValid: false,
        errorMessage: maxMessage || `Значення повинно бути не більше ${max}`,
      };
    }

    return {
      isValid: true,
      errorMessage: '',
    };
  } catch (error) {
    logger.error('Помилка валідації числа', 'validateNumber', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація цілого числа
 * @param {string|number} value - Значення для перевірки
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateInteger(value, options = {}) {
  return validateNumber(value, { ...options, integer: true });
}

/**
 * Валідація збігу значень
 * @param {*} value - Значення для перевірки
 * @param {*} targetValue - Цільове значення для порівняння
 * @param {string} [errorMessage] - Користувацьке повідомлення про помилку
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateMatch(value, targetValue, errorMessage) {
  try {
    // Порівнюємо значення
    const isValid = value === targetValue;

    return {
      isValid,
      errorMessage: isValid ? '' : errorMessage || 'Значення не співпадають',
    };
  } catch (error) {
    logger.error('Помилка валідації збігу значень', 'validateMatch', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація пароля
 * @param {string} value - Значення для перевірки
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validatePassword(value, options = {}) {
  try {
    const {
      minLength = 8, // Мінімальна довжина
      strength = 'medium', // Рівень складності (low, medium, high)
      errorMessage, // Користувацьке повідомлення про помилку
    } = options;

    // Перевіряємо мінімальну довжину
    if (String(value).length < minLength) {
      return {
        isValid: false,
        errorMessage: errorMessage || `Пароль повинен містити щонайменше ${minLength} символів`,
      };
    }

    let isValid = false;
    let message = '';

    // Перевіряємо складність пароля
    switch (strength) {
      case 'low':
        // Просто мінімальна довжина
        isValid = true;
        break;

      case 'medium':
        // Повинен містити літери та цифри
        isValid = /[A-Za-z]/.test(value) && /[0-9]/.test(value);
        message = 'Пароль повинен містити літери та цифри';
        break;

      case 'high':
        // Повинен містити великі та малі літери, цифри та спеціальні символи
        isValid =
          /[A-Z]/.test(value) &&
          /[a-z]/.test(value) &&
          /[0-9]/.test(value) &&
          /[^A-Za-z0-9]/.test(value);
        message = 'Пароль повинен містити великі та малі літери, цифри та спеціальні символи';
        break;

      default:
        // За замовчуванням середній рівень
        isValid = /[A-Za-z]/.test(value) && /[0-9]/.test(value);
        message = 'Пароль повинен містити літери та цифри';
    }

    return {
      isValid,
      errorMessage: isValid ? '' : errorMessage || message,
    };
  } catch (error) {
    logger.error('Помилка валідації пароля', 'validatePassword', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація чекбокса
 * @param {boolean} value - Значення для перевірки
 * @param {string} [errorMessage] - Користувацьке повідомлення про помилку
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateCheckbox(value, errorMessage) {
  try {
    const isValid = value === true;

    return {
      isValid,
      errorMessage: isValid ? '' : errorMessage || 'Це поле повинно бути відмічено',
    };
  } catch (error) {
    logger.error('Помилка валідації чекбокса', 'validateCheckbox', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація дати
 * @param {string} value - Значення для перевірки
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateDate(value, options = {}) {
  try {
    const {
      format = 'yyyy-mm-dd', // Формат дати
      min, // Мінімальна дата
      max, // Максимальна дата
      errorMessage, // Користувацьке повідомлення про помилку
      minMessage, // Повідомлення про помилку мінімальної дати
      maxMessage, // Повідомлення про помилку максимальної дати
    } = options;

    // Реалізуємо простий алгоритм валідації дати
    let isValid = false;

    // Розбираємо формат
    const separator = format.includes('/') ? '/' : format.includes('-') ? '-' : '.';
    const parts = String(value).split(separator);

    if (parts.length !== 3) {
      return {
        isValid: false,
        errorMessage: errorMessage || `Введіть коректну дату у форматі ${format}`,
      };
    }

    let year, month, day;

    // Аналізуємо формат та витягуємо компоненти дати
    if (format === 'yyyy-mm-dd' || format === 'yyyy/mm/dd') {
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
      day = parseInt(parts[2]);
    } else if (format === 'dd.mm.yyyy' || format === 'dd/mm/yyyy') {
      day = parseInt(parts[0]);
      month = parseInt(parts[1]);
      year = parseInt(parts[2]);
    } else if (format === 'mm/dd/yyyy') {
      month = parseInt(parts[0]);
      day = parseInt(parts[1]);
      year = parseInt(parts[2]);
    } else {
      return {
        isValid: false,
        errorMessage: 'Невідомий формат дати',
      };
    }

    // Перевіряємо компоненти на валідність
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return {
        isValid: false,
        errorMessage: errorMessage || `Введіть коректну дату у форматі ${format}`,
      };
    }

    // Перевіряємо межі компонентів
    if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
      return {
        isValid: false,
        errorMessage: errorMessage || 'Введіть коректну дату',
      };
    }

    // Перевіряємо кількість днів у місяці
    const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day > daysInMonth[month - 1]) {
      return {
        isValid: false,
        errorMessage: errorMessage || 'Невірна кількість днів у місяці',
      };
    }

    // Створюємо об'єкт дати для подальших перевірок
    const dateObj = new Date(year, month - 1, day);

    // Перевіряємо мінімальну дату
    if (min) {
      const minDate = min instanceof Date ? min : new Date(min);
      if (dateObj < minDate) {
        return {
          isValid: false,
          errorMessage: minMessage || `Дата повинна бути не раніше ${minDate.toLocaleDateString()}`,
        };
      }
    }

    // Перевіряємо максимальну дату
    if (max) {
      const maxDate = max instanceof Date ? max : new Date(max);
      if (dateObj > maxDate) {
        return {
          isValid: false,
          errorMessage:
            maxMessage || `Дата повинна бути не пізніше ${maxDate.toLocaleDateString()}`,
        };
      }
    }

    return {
      isValid: true,
      errorMessage: '',
    };
  } catch (error) {
    logger.error('Помилка валідації дати', 'validateDate', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Перевірка високосного року
 * @param {number} year - Рік
 * @returns {boolean} Високосний рік чи ні
 */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Виконання валідації за типом
 * @param {*} value - Значення для валідації
 * @param {string} validationType - Тип валідації
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validate(value, validationType, options = {}) {
  try {
    // Обробка різних типів валідації
    switch (validationType) {
      case 'required':
        return validateRequired(value, options.errorMessage);

      case 'email':
        return validateEmail(value, options.errorMessage);

      case 'phone':
        return validatePhone(value, options.errorMessage);

      case 'url':
        return validateUrl(value, options.errorMessage);

      case 'number':
        return validateNumber(value, options);

      case 'integer':
        return validateInteger(value, options);

      case 'length':
        return validateLength(value, options.minLength, options.maxLength, options.errorMessage);

      case 'match':
        return validateMatch(value, options.targetValue, options.errorMessage);

      case 'password':
        return validatePassword(value, options);

      case 'checkbox':
        return validateCheckbox(value, options.errorMessage);

      case 'date':
        return validateDate(value, options);

      case 'pattern':
      case 'regex':
        return validatePattern(value, options.pattern || options.regex, options.errorMessage);

      default:
        // Якщо тип валідації не розпізнано, повертаємо успішний результат
        return { isValid: true, errorMessage: '' };
    }
  } catch (error) {
    logger.error('Помилка виконання валідації', 'validate', {
      validationType,
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка виконання валідації: ' + error.message,
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
  logger.debug('Оновлено налаштування модуля валідації', 'updateConfig', { newConfig });
  return { ...config };
}

// Експорт основних функцій та регулярних виразів
export default {
  validate,
  validateRequired,
  validatePattern,
  validateLength,
  validateEmail,
  validatePhone,
  validateUrl,
  validateNumber,
  validateInteger,
  validateMatch,
  validatePassword,
  validateCheckbox,
  validateDate,
  updateConfig,

  // Експортуємо регулярні вирази для зовнішнього використання
  regexCache,

  // Експортуємо конфігурацію як readonly
  get config() {
    return { ...config };
  },
};
