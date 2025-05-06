     /**
 * Централізований обробник помилок
 *
 * Відповідає за:
 * - Стандартизацію обробки помилок у всіх модулях
 * - Логування помилок з рівнями важливості
 * - Агрегацію помилок для аналітики
 * - Відправку подій про помилки
 */

// Рівні важливості помилок
export const ERROR_LEVELS = {
  CRITICAL: 'critical',  // Критичні помилки, які порушують роботу системи
  ERROR: 'error',        // Важливі помилки, які впливають на функціонал
  WARNING: 'warning',    // Попередження, які не блокують роботу
  INFO: 'info'           // Інформаційні повідомлення про потенційні проблеми
};

// Категорії помилок
export const ERROR_CATEGORIES = {
  API: 'api',            // Помилки взаємодії з API
  NETWORK: 'network',    // Мережеві помилки
  AUTH: 'auth',          // Помилки авторизації
  VALIDATION: 'validation', // Помилки валідації даних
  INIT: 'initialization', // Помилки ініціалізації
  LOGIC: 'logic',        // Логічні помилки в бізнес-логіці
  TIMEOUT: 'timeout',    // Помилки таймауту
  UNKNOWN: 'unknown'     // Невідомі помилки
};

class ErrorHandler {
  constructor() {
    // Історія помилок для аналізу
    this.errorHistory = [];

    // Максимальна кількість помилок в історії
    this.maxHistoryLength = 50;

    // Налаштування рівнів логування
    this.logLevels = {
      [ERROR_LEVELS.CRITICAL]: true,
      [ERROR_LEVELS.ERROR]: true,
      [ERROR_LEVELS.WARNING]: true,
      [ERROR_LEVELS.INFO]: true
    };

    // Налаштування консольного виведення
    this.consoleOutput = {
      [ERROR_LEVELS.CRITICAL]: true,
      [ERROR_LEVELS.ERROR]: true,
      [ERROR_LEVELS.WARNING]: true,
      [ERROR_LEVELS.INFO]: false
    };

    // Налаштування відправки подій
    this.eventEmitting = {
      [ERROR_LEVELS.CRITICAL]: true,
      [ERROR_LEVELS.ERROR]: true,
      [ERROR_LEVELS.WARNING]: false,
      [ERROR_LEVELS.INFO]: false
    };

    // Підписка на необроблені помилки
    this.setupGlobalErrorHandlers();
  }

  /**
   * Налаштування глобальних обробників помилок
   */
  setupGlobalErrorHandlers() {
    if (typeof window !== 'undefined') {
      // Перехоплення необроблених помилок
      window.onerror = (message, source, lineno, colno, error) => {
        this.handleError(error || new Error(message), {
          level: ERROR_LEVELS.CRITICAL,
          category: ERROR_CATEGORIES.UNKNOWN,
          source: source,
          line: lineno,
          column: colno,
          context: 'Глобальна необроблена помилка'
        });

        // Не блокуємо стандартну обробку
        return false;
      };

      // Перехоплення необроблених відхилень промісів
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason, {
          level: ERROR_LEVELS.CRITICAL,
          category: ERROR_CATEGORIES.UNKNOWN,
          context: 'Необроблене відхилення промісу'
        });
      });
    }
  }

  /**
   * Обробка помилки
   * @param {Error|string} error - Об'єкт помилки або повідомлення
   * @param {Object} options - Опції обробки
   */
  handleError(error, options = {}) {
    const errorObj = this.normalizeError(error);

    // Налаштування за замовчуванням
    const settings = {
      level: ERROR_LEVELS.ERROR,
      category: ERROR_CATEGORIES.UNKNOWN,
      context: '',
      module: '',
      silent: false,
      ...options
    };

    // Створюємо запис про помилку
    const errorRecord = {
      timestamp: new Date(),
      error: errorObj,
      message: errorObj.message,
      stack: errorObj.stack,
      level: settings.level,
      category: settings.category,
      context: settings.context,
      module: settings.module,
      details: errorObj.details || {}
    };

    // Додаємо в історію
    this.addToHistory(errorRecord);

    // Консольне логування
    if (this.consoleOutput[settings.level] && !settings.silent) {
      this.logToConsole(errorRecord);
    }

    // Відправка події для реагування іншими модулями
    if (this.eventEmitting[settings.level] && typeof document !== 'undefined') {
      this.emitErrorEvent(errorRecord);
    }

    return errorRecord;
  }

  /**
   * Нормалізація помилки
   * @param {Error|string} error - Об'єкт помилки або повідомлення
   * @returns {Error} Нормалізований об'єкт помилки
   */
  normalizeError(error) {
    if (typeof error === 'string') {
      return new Error(error);
    } else if (error instanceof Error) {
      return error;
    } else if (error && typeof error === 'object') {
      const err = new Error(error.message || 'Об\'єкт помилки');
      err.details = error;
      return err;
    } else {
      return new Error('Невідома помилка');
    }
  }

  /**
   * Додавання помилки в історію
   * @param {Object} errorRecord - Запис про помилку
   */
  addToHistory(errorRecord) {
    this.errorHistory.unshift(errorRecord);

    // Обмежуємо довжину історії
    if (this.errorHistory.length > this.maxHistoryLength) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistoryLength);
    }
  }

  /**
   * Логування помилки в консоль
   * @param {Object} errorRecord - Запис про помилку
   */
  logToConsole(errorRecord) {
    const prefix = `[${errorRecord.level.toUpperCase()}][${errorRecord.category}]`;
    const moduleInfo = errorRecord.module ? `[${errorRecord.module}]` : '';
    const contextInfo = errorRecord.context ? ` - ${errorRecord.context}` : '';

    switch (errorRecord.level) {
      case ERROR_LEVELS.CRITICAL:
        console.error(`${prefix}${moduleInfo}: ${errorRecord.message}${contextInfo}`, errorRecord.error);
        console.error('Стек виклику:', errorRecord.stack);
        break;
      case ERROR_LEVELS.ERROR:
        console.error(`${prefix}${moduleInfo}: ${errorRecord.message}${contextInfo}`, errorRecord.error);
        break;
      case ERROR_LEVELS.WARNING:
        console.warn(`${prefix}${moduleInfo}: ${errorRecord.message}${contextInfo}`);
        break;
      case ERROR_LEVELS.INFO:
        console.info(`${prefix}${moduleInfo}: ${errorRecord.message}${contextInfo}`);
        break;
    }
  }

  /**
   * Відправка події про помилку
   * @param {Object} errorRecord - Запис про помилку
   */
  emitErrorEvent(errorRecord) {
    const eventName = `app-error-${errorRecord.level}`;

    document.dispatchEvent(new CustomEvent(eventName, {
      detail: {
        ...errorRecord,
        timestamp: errorRecord.timestamp.toISOString()
      }
    }));

    // Також відправляємо загальну подію
    document.dispatchEvent(new CustomEvent('app-error', {
      detail: {
        ...errorRecord,
        timestamp: errorRecord.timestamp.toISOString()
      }
    }));
  }

  /**
   * Створення обробника помилок для конкретного модуля
   * @param {string} moduleName - Назва модуля
   * @returns {Object} Обробник помилок для модуля
   */
  createModuleHandler(moduleName) {
    return {
      critical: (error, context = '', options = {}) => {
        return this.handleError(error, {
          level: ERROR_LEVELS.CRITICAL,
          module: moduleName,
          context,
          ...options
        });
      },

      error: (error, context = '', options = {}) => {
        return this.handleError(error, {
          level: ERROR_LEVELS.ERROR,
          module: moduleName,
          context,
          ...options
        });
      },

      warning: (error, context = '', options = {}) => {
        return this.handleError(error, {
          level: ERROR_LEVELS.WARNING,
          module: moduleName,
          context,
          ...options
        });
      },

      info: (error, context = '', options = {}) => {
        return this.handleError(error, {
          level: ERROR_LEVELS.INFO,
          module: moduleName,
          context,
          ...options
        });
      },

      handle: (error, level = ERROR_LEVELS.ERROR, context = '', options = {}) => {
        return this.handleError(error, {
          level,
          module: moduleName,
          context,
          ...options
        });
      }
    };
  }

  /**
   * Отримання історії помилок
   * @param {Object} filters - Фільтри для історії
   * @returns {Array} Відфільтрована історія помилок
   */
  getErrorHistory(filters = {}) {
    let history = [...this.errorHistory];

    // Фільтрація за рівнем
    if (filters.level) {
      history = history.filter(record => record.level === filters.level);
    }

    // Фільтрація за категорією
    if (filters.category) {
      history = history.filter(record => record.category === filters.category);
    }

    // Фільтрація за модулем
    if (filters.module) {
      history = history.filter(record => record.module === filters.module);
    }

    // Фільтрація за контекстом
    if (filters.context) {
      history = history.filter(record => record.context.includes(filters.context));
    }

    // Фільтрація за часовим діапазоном
    if (filters.from) {
      const fromDate = new Date(filters.from);
      history = history.filter(record => record.timestamp >= fromDate);
    }

    if (filters.to) {
      const toDate = new Date(filters.to);
      history = history.filter(record => record.timestamp <= toDate);
    }

    return history;
  }

  /**
   * Очищення історії помилок
   */
  clearErrorHistory() {
    this.errorHistory = [];
  }

  /**
   * Налаштування обробника помилок
   * @param {Object} options - Налаштування
   */
  configure(options = {}) {
    // Оновлення налаштувань логування
    if (options.logLevels) {
      this.logLevels = {
        ...this.logLevels,
        ...options.logLevels
      };
    }

    // Оновлення налаштувань консольного виведення
    if (options.consoleOutput) {
      this.consoleOutput = {
        ...this.consoleOutput,
        ...options.consoleOutput
      };
    }

    // Оновлення налаштувань відправки подій
    if (options.eventEmitting) {
      this.eventEmitting = {
        ...this.eventEmitting,
        ...options.eventEmitting
      };
    }

    // Оновлення максимальної довжини історії
    if (options.maxHistoryLength) {
      this.maxHistoryLength = options.maxHistoryLength;
    }
  }
}

// Створюємо і експортуємо єдиний екземпляр обробника помилок
const errorHandler = new ErrorHandler();

// Додаємо у глобальний простір для використання в інших скриптах
if (typeof window !== 'undefined') {
  window.ErrorHandler = errorHandler;
}

export default errorHandler;