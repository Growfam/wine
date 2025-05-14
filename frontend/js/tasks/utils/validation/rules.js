/**
 * Модуль правил валідації для різних типів полів
 *
 * Відповідає за:
 * - Спеціалізовані правила валідації
 * - Складні правила валідації
 * - Надання готових валідаторів
 *
 * @version 1.0.0
 */

import { getLogger } from '../core/logger.js';
import * as coreValidators from './core.js';
import { parseDate } from '../time/date.js';

// Створюємо логер для модуля
const logger = getLogger('ValidationRules');

/**
 * Валідація імені користувача
 * @param {string} value - Значення для перевірки
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateUsername(value, options = {}) {
  try {
    const { minLength = 3, maxLength = 20, allowSpecialChars = false, errorMessage } = options;

    // Базова перевірка довжини
    const lengthResult = coreValidators.validateLength(
      value,
      minLength,
      maxLength,
      `Ім'я користувача повинно містити від ${minLength} до ${maxLength} символів`
    );

    if (!lengthResult.isValid) {
      return lengthResult;
    }

    // Різні правила в залежності від дозволу спеціальних символів
    let pattern;
    let message;

    if (allowSpecialChars) {
      // Дозволяємо букви, цифри, підкреслення, дефіс та інші безпечні спеціальні символи
      pattern = /^[a-zA-Z0-9_\-\.@+]+$/;
      message = `Ім'я користувача може містити літери, цифри та спеціальні символи (_-.@+)`;
    } else {
      // Дозволяємо тільки букви, цифри, підкреслення та дефіс
      pattern = /^[a-zA-Z0-9_-]+$/;
      message = `Ім'я користувача може містити лише літери, цифри, підкреслення (_) та дефіс (-)`;
    }

    const isValid = pattern.test(String(value));

    return {
      isValid,
      errorMessage: isValid ? '' : errorMessage || message,
    };
  } catch (error) {
    logger.error('Помилка валідації імені користувача', 'validateUsername', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація імені та прізвища
 * @param {string} value - Значення для перевірки
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validatePersonName(value, options = {}) {
  try {
    const {
      minLength = 2,
      maxLength = 50,
      allowNumbers = false,
      allowSpecialChars = false,
      errorMessage,
    } = options;

    // Базова перевірка довжини
    const lengthResult = coreValidators.validateLength(
      value,
      minLength,
      maxLength,
      `Ім'я повинно містити від ${minLength} до ${maxLength} символів`
    );

    if (!lengthResult.isValid) {
      return lengthResult;
    }

    // Формуємо шаблон
    let pattern;

    if (allowNumbers && allowSpecialChars) {
      // Дозволяємо літери, цифри, пробіли та деякі спеціальні символи
      pattern = /^[a-zA-Zа-яА-ЯіІїЇєЄґҐ0-9\s\-'\.]+$/u;
    } else if (allowNumbers) {
      // Дозволяємо літери, цифри та пробіли
      pattern = /^[a-zA-Zа-яА-ЯіІїЇєЄґҐ0-9\s\-']+$/u;
    } else if (allowSpecialChars) {
      // Дозволяємо літери, пробіли та деякі спеціальні символи
      pattern = /^[a-zA-Zа-яА-ЯіІїЇєЄґҐ\s\-'\.]+$/u;
    } else {
      // Дозволяємо тільки літери та пробіли
      pattern = /^[a-zA-Zа-яА-ЯіІїЇєЄґҐ\s\-']+$/u;
    }

    const isValid = pattern.test(String(value));

    return {
      isValid,
      errorMessage: isValid ? '' : errorMessage || "Ім'я містить неприпустимі символи",
    };
  } catch (error) {
    logger.error('Помилка валідації імені особи', 'validatePersonName', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація адреси електронної пошти з додатковими параметрами
 * @param {string} value - Значення для перевірки
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateEmailExtended(value, options = {}) {
  try {
    const {
      allowedDomains = [], // Дозволені домени
      blockedDomains = [], // Заблоковані домени
      corporateOnly = false, // Тільки корпоративні (не публічні) домени
      errorMessage,
      domainErrorMessage,
    } = options;

    // Базова валідація електронної пошти
    const baseResult = coreValidators.validateEmail(value, errorMessage);

    if (!baseResult.isValid) {
      return baseResult;
    }

    // Якщо вказані додаткові правила
    if (allowedDomains.length || blockedDomains.length || corporateOnly) {
      // Отримуємо домен
      const emailParts = String(value).split('@');
      if (emailParts.length !== 2) {
        return {
          isValid: false,
          errorMessage: errorMessage || 'Невірний формат електронної адреси',
        };
      }

      const domain = emailParts[1].toLowerCase();

      // Перевіряємо дозволені домени
      if (allowedDomains.length > 0) {
        const isDomainAllowed = allowedDomains.some(
          (allowedDomain) =>
            domain === allowedDomain.toLowerCase() ||
            domain.endsWith('.' + allowedDomain.toLowerCase())
        );

        if (!isDomainAllowed) {
          return {
            isValid: false,
            errorMessage: domainErrorMessage || `Домен ${domain} не входить до списку дозволених`,
          };
        }
      }

      // Перевіряємо заблоковані домени
      if (blockedDomains.length > 0) {
        const isDomainBlocked = blockedDomains.some(
          (blockedDomain) =>
            domain === blockedDomain.toLowerCase() ||
            domain.endsWith('.' + blockedDomain.toLowerCase())
        );

        if (isDomainBlocked) {
          return {
            isValid: false,
            errorMessage: domainErrorMessage || `Домен ${domain} заблоковано`,
          };
        }
      }

      // Перевіряємо, чи домен публічний
      if (corporateOnly) {
        const publicDomains = [
          'gmail.com',
          'yahoo.com',
          'hotmail.com',
          'outlook.com',
          'live.com',
          'mail.ru',
          'yandex.ru',
          'icloud.com',
          'aol.com',
          'protonmail.com',
          'ukr.net',
          'i.ua',
          'meta.ua',
          'bigmir.net',
        ];

        const isPublicDomain = publicDomains.some(
          (publicDomain) => domain === publicDomain.toLowerCase()
        );

        if (isPublicDomain) {
          return {
            isValid: false,
            errorMessage:
              domainErrorMessage || 'Будь ласка, використовуйте корпоративну електронну адресу',
          };
        }
      }
    }

    return {
      isValid: true,
      errorMessage: '',
    };
  } catch (error) {
    logger.error('Помилка розширеної валідації email', 'validateEmailExtended', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація паролю за вимогами NIST
 * @param {string} value - Значення для перевірки
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateNistPassword(value, options = {}) {
  try {
    const {
      minLength = 8,
      blockedPasswords = [], // Список заблокованих паролів
      checkCommon = true, // Перевірка на наявність у списку поширених паролів
      errorMessage,
    } = options;

    // Перевіряємо мінімальну довжину
    if (String(value).length < minLength) {
      return {
        isValid: false,
        errorMessage: errorMessage || `Пароль повинен містити щонайменше ${minLength} символів`,
      };
    }

    // Перевіряємо заблоковані паролі
    if (blockedPasswords.includes(String(value))) {
      return {
        isValid: false,
        errorMessage: errorMessage || 'Цей пароль заблокований з міркувань безпеки',
      };
    }

    // Перевіряємо поширені паролі (спрощена реалізація)
    if (checkCommon) {
      const commonPasswords = [
        'password',
        'qwerty',
        '123456',
        '123456789',
        '12345678',
        '12345',
        '1234567',
        '1234567890',
        'admin',
        'welcome',
        'monkey',
        'letmein',
        'football',
        '111111',
        '123123',
        'dragon',
        '1234',
        'master',
        'sunshine',
        'iloveyou',
        'princess',
        'admin123',
        'qwerty123',
        'qazwsx',
        'qwe123',
      ];

      if (commonPasswords.includes(String(value).toLowerCase())) {
        return {
          isValid: false,
          errorMessage: errorMessage || 'Цей пароль є занадто поширеним',
        };
      }
    }

    return {
      isValid: true,
      errorMessage: '',
    };
  } catch (error) {
    logger.error('Помилка валідації NIST пароля', 'validateNistPassword', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація кредитної картки
 * @param {string} value - Значення для перевірки
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateCreditCard(value, options = {}) {
  try {
    const {
      acceptedTypes = [], // Типи карток: visa, mastercard, amex, etc.
      errorMessage,
      typeErrorMessage,
    } = options;

    // Видаляємо пробіли, дефіси тощо
    const cardNumber = String(value).replace(/[\s-]/g, '');

    // Перевіряємо, що всі символи - цифри
    if (!/^\d+$/.test(cardNumber)) {
      return {
        isValid: false,
        errorMessage: errorMessage || 'Номер картки повинен містити тільки цифри',
      };
    }

    // Перевіряємо довжину
    if (cardNumber.length < 13 || cardNumber.length > 19) {
      return {
        isValid: false,
        errorMessage: errorMessage || 'Невірна довжина номера картки',
      };
    }

    // Визначаємо тип картки
    let cardType = '';

    // Visa
    if (/^4/.test(cardNumber)) {
      cardType = 'visa';
    }
    // Mastercard
    else if (/^5[1-5]/.test(cardNumber) || /^2[2-7]/.test(cardNumber)) {
      cardType = 'mastercard';
    }
    // American Express
    else if (/^3[47]/.test(cardNumber)) {
      cardType = 'amex';
    }
    // Discover
    else if (/^6(?:011|5)/.test(cardNumber)) {
      cardType = 'discover';
    }
    // JCB
    else if (/^35/.test(cardNumber)) {
      cardType = 'jcb';
    }
    // Diners Club
    else if (/^3(?:0[0-5]|[68])/.test(cardNumber)) {
      cardType = 'diners';
    }

    // Перевіряємо, чи тип картки входить до дозволених
    if (acceptedTypes.length > 0 && cardType && !acceptedTypes.includes(cardType)) {
      return {
        isValid: false,
        errorMessage: typeErrorMessage || `Картки типу ${cardType} не приймаються`,
      };
    }

    // Валідація за алгоритмом Луна (Luhn algorithm)
    let sum = 0;
    let shouldDouble = false;

    // Проходимо цифри з кінця
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber.charAt(i));

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    // Номер картки валідний, якщо сума за алгоритмом Луна ділиться на 10 без остачі
    const isValid = sum % 10 === 0;

    return {
      isValid,
      errorMessage: isValid ? '' : errorMessage || 'Невірний номер картки',
      cardType,
    };
  } catch (error) {
    logger.error('Помилка валідації кредитної картки', 'validateCreditCard', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація дати з розширеними перевірками
 * @param {string|Date} value - Значення для перевірки
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateDateExtended(value, options = {}) {
  try {
    const {
      format = 'yyyy-mm-dd', // Формат дати
      min, // Мінімальна дата
      max, // Максимальна дата
      disallowedDates = [], // Заборонені дати
      disallowedDays = [], // Заборонені дні тижня (0-6, де 0 - неділя)
      allowedDays = [], // Дозволені дні тижня (якщо вказано, інші дні заборонені)
      minAge, // Мінімальний вік (для дат народження)
      maxAge, // Максимальний вік (для дат народження)
      errorMessage,
      minMessage,
      maxMessage,
      disallowedMessage,
      dayMessage,
      ageMessage,
    } = options;

    // Парсимо дату
    const dateObj = parseDate(value);

    if (!dateObj || isNaN(dateObj.getTime())) {
      return {
        isValid: false,
        errorMessage: errorMessage || `Введіть коректну дату у форматі ${format}`,
      };
    }

    // Перевіряємо мінімальну дату
    if (min) {
      const minDate = parseDate(min);
      if (minDate && dateObj < minDate) {
        return {
          isValid: false,
          errorMessage: minMessage || `Дата повинна бути не раніше ${minDate.toLocaleDateString()}`,
        };
      }
    }

    // Перевіряємо максимальну дату
    if (max) {
      const maxDate = parseDate(max);
      if (maxDate && dateObj > maxDate) {
        return {
          isValid: false,
          errorMessage:
            maxMessage || `Дата повинна бути не пізніше ${maxDate.toLocaleDateString()}`,
        };
      }
    }

    // Перевіряємо заборонені дати
    if (disallowedDates.length > 0) {
      const isDisallowed = disallowedDates.some((disallowedDate) => {
        const disDate = parseDate(disallowedDate);
        return disDate && disDate.getTime() === dateObj.getTime();
      });

      if (isDisallowed) {
        return {
          isValid: false,
          errorMessage: disallowedMessage || 'Ця дата недоступна для вибору',
        };
      }
    }

    // Перевіряємо дні тижня
    const dayOfWeek = dateObj.getDay(); // 0-6, де 0 - неділя

    // Перевіряємо заборонені дні тижня
    if (disallowedDays.length > 0 && disallowedDays.includes(dayOfWeek)) {
      // Назви днів тижня для повідомлення
      const dayNames = [
        'неділя',
        'понеділок',
        'вівторок',
        'середа',
        'четвер',
        "п'ятниця",
        'субота',
      ];

      return {
        isValid: false,
        errorMessage: dayMessage || `${dayNames[dayOfWeek]} недоступна для вибору`,
      };
    }

    // Перевіряємо дозволені дні тижня, якщо вказані
    if (allowedDays.length > 0 && !allowedDays.includes(dayOfWeek)) {
      return {
        isValid: false,
        errorMessage: dayMessage || 'Цей день тижня недоступний для вибору',
      };
    }

    // Перевіряємо обмеження за віком
    if (minAge !== undefined || maxAge !== undefined) {
      const today = new Date();
      const birthDate = new Date(dateObj);

      // Обчислюємо вік
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      // Якщо день народження в цьому році ще не настав, зменшуємо вік на 1
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // Перевіряємо мінімальний вік
      if (minAge !== undefined && age < minAge) {
        return {
          isValid: false,
          errorMessage: ageMessage || `Мінімальний вік повинен бути ${minAge} років`,
        };
      }

      // Перевіряємо максимальний вік
      if (maxAge !== undefined && age > maxAge) {
        return {
          isValid: false,
          errorMessage: ageMessage || `Максимальний вік повинен бути ${maxAge} років`,
        };
      }
    }

    return {
      isValid: true,
      errorMessage: '',
    };
  } catch (error) {
    logger.error('Помилка розширеної валідації дати', 'validateDateExtended', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація файлу
 * @param {File} file - Об'єкт файлу
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateFile(file, options = {}) {
  try {
    const {
      maxSize = 5 * 1024 * 1024, // Максимальний розмір в байтах (за замовчуванням 5 МБ)
      allowedTypes = [], // Дозволені MIME типи
      allowedExtensions = [], // Дозволені розширення
      errorMessage,
      sizeErrorMessage,
      typeErrorMessage,
      extensionErrorMessage,
    } = options;

    // Перевіряємо, чи переданий файл
    if (!file || !file.name || !file.type) {
      return {
        isValid: false,
        errorMessage: errorMessage || 'Файл не вибрано',
      };
    }

    // Перевіряємо розмір файлу
    if (file.size > maxSize) {
      const maxSizeMB = Math.round((maxSize / (1024 * 1024)) * 10) / 10;
      return {
        isValid: false,
        errorMessage: sizeErrorMessage || `Розмір файлу перевищує ${maxSizeMB} МБ`,
      };
    }

    // Перевіряємо MIME тип
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        errorMessage:
          typeErrorMessage ||
          `Неприпустимий тип файлу. Підтримувані типи: ${allowedTypes.join(', ')}`,
      };
    }

    // Перевіряємо розширення
    if (allowedExtensions.length > 0) {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      if (!allowedExtensions.includes(fileExtension)) {
        return {
          isValid: false,
          errorMessage:
            extensionErrorMessage ||
            `Неприпустиме розширення файлу. Підтримувані розширення: ${allowedExtensions.join(', ')}`,
        };
      }
    }

    return {
      isValid: true,
      errorMessage: '',
    };
  } catch (error) {
    logger.error('Помилка валідації файлу', 'validateFile', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація адреси
 * @param {string} value - Значення для перевірки
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateAddress(value, options = {}) {
  try {
    const {
      minLength = 5,
      maxLength = 200,
      requireHouseNumber = true,
      allowPOBox = false,
      errorMessage,
    } = options;

    // Базова перевірка довжини
    const lengthResult = coreValidators.validateLength(
      value,
      minLength,
      maxLength,
      `Адреса повинна містити від ${minLength} до ${maxLength} символів`
    );

    if (!lengthResult.isValid) {
      return lengthResult;
    }

    // Очищений текст адреси
    const address = String(value).trim();

    // Перевіряємо наявність номеру будинку, якщо це потрібно
    if (requireHouseNumber) {
      // Проста перевірка на наявність числа в адресі
      const hasNumber = /\d/.test(address);

      if (!hasNumber) {
        return {
          isValid: false,
          errorMessage: errorMessage || 'Адреса повинна містити номер будинку',
        };
      }
    }

    // Перевіряємо, чи є адреса поштовою скринькою, якщо вони заборонені
    if (
      !allowPOBox &&
      /\b[P|p]\.?\s*[O|o]\.?\s*[B|b][O|o][X|x]?|поштова скринька|а\/с\b/.test(address)
    ) {
      return {
        isValid: false,
        errorMessage: errorMessage || 'Використання поштової скриньки не допускається',
      };
    }

    return {
      isValid: true,
      errorMessage: '',
    };
  } catch (error) {
    logger.error('Помилка валідації адреси', 'validateAddress', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

/**
 * Валідація телефонного номера з розширеними перевірками
 * @param {string} value - Значення для перевірки
 * @param {Object} options - Опції валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validatePhoneExtended(value, options = {}) {
  try {
    const {
      country = 'UA', // Код країни (UA, US, тощо)
      allowedCountries = [], // Дозволені коди країн
      formatType = 'flexible', // Тип формату (strict, flexible)
      errorMessage,
      countryErrorMessage,
    } = options;

    // Очищаємо номер від усіх нецифрових символів, крім + на початку
    let cleanedNumber = String(value).trim();
    const startsWithPlus = cleanedNumber.startsWith('+');

    cleanedNumber = cleanedNumber.replace(/\D/g, '');
    if (startsWithPlus) {
      cleanedNumber = '+' + cleanedNumber;
    }

    // Перевіряємо довжину
    if (cleanedNumber.length < 10 || cleanedNumber.length > 15) {
      return {
        isValid: false,
        errorMessage: errorMessage || 'Невірна довжина телефонного номера',
      };
    }

    // Правила для різних країн
    const countryRules = {
      UA: {
        pattern: /^(?:\+?38)?0\d{9}$/,
        formatted: '+38 0XX XXX XX XX',
      },
      US: {
        pattern: /^(?:\+?1)?[2-9]\d{2}[2-9]\d{6}$/,
        formatted: '+1 XXX XXX XXXX',
      },
      UK: {
        pattern: /^(?:\+?44)?[1-9]\d{9,10}$/,
        formatted: '+44 XXXX XXXXXX',
      },
      // Можна додати правила для інших країн
    };

    // Якщо вказані дозволені країни, перевіряємо
    if (allowedCountries.length > 0 && !allowedCountries.includes(country)) {
      return {
        isValid: false,
        errorMessage: countryErrorMessage || `Номери країни ${country} не підтримуються`,
      };
    }

    // Перевіряємо за правилами вказаної країни
    const rule = countryRules[country];

    if (rule) {
      // Якщо обрано строгий формат, застосовуємо регулярний вираз
      if (formatType === 'strict' && rule.pattern) {
        const isValid = rule.pattern.test(cleanedNumber);

        if (!isValid) {
          return {
            isValid: false,
            errorMessage:
              errorMessage || `Невірний формат номера. Очікуваний формат: ${rule.formatted}`,
          };
        }
      }
      // Для гнучкого формату перевіряємо тільки базові правила
      else {
        // Базова перевірка вже виконана вище (довжина)
      }
    }

    return {
      isValid: true,
      errorMessage: '',
      formattedNumber: cleanedNumber,
    };
  } catch (error) {
    logger.error('Помилка розширеної валідації телефону', 'validatePhoneExtended', {
      error: error.message,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка валідації: ' + error.message,
    };
  }
}

// Експорт всіх правил валідації
export default {
  validateUsername,
  validatePersonName,
  validateEmailExtended,
  validateNistPassword,
  validateCreditCard,
  validateDateExtended,
  validateFile,
  validateAddress,
  validatePhoneExtended,

  // Експортуємо базові валідатори з core для зручності
  ...coreValidators,
};
