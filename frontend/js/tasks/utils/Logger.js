/**
 * Централізована система логування
 *
 * Забезпечує єдиний інтерфейс для логування в різних модулях
 * з підтримкою рівнів, категорій та форматування.
 *
 * @version 1.0.0
 */

// Рівні логування в порядку зростання важливості
export const LOG_LEVELS = {
    TRACE: 10,    // Найдетальніший рівень для трасування виконання
    DEBUG: 20,    // Детальна інформація для розробників
    INFO: 30,     // Загальна інформація про роботу системи
    WARN: 40,     // Попередження, які не блокують роботу
    ERROR: 50,    // Помилки, які можуть впливати на функціональність
    FATAL: 60     // Критичні помилки, які зупиняють роботу
};

// Категорії логів для кращої організації
export const LOG_CATEGORIES = {
    INIT: 'initialization',    // Ініціалізація модулів
    NETWORK: 'network',        // Мережеві операції
    API: 'api',                // API взаємодія
    UI: 'ui',                  // Взаємодія з інтерфейсом
    LOGIC: 'logic',            // Бізнес-логіка
    AUTH: 'authentication',    // Аутентифікація та авторизація
    STORAGE: 'storage',        // Робота зі сховищем
    TIMEOUT: 'timeout',        // Таймаути операцій
    RENDERING: 'rendering',    // Відображення компонентів
    ANIMATION: 'animation',    // Анімації та візуальні ефекти
    PERFORMANCE: 'performance',// Продуктивність
    UNKNOWN: 'unknown'         // Некатегоризовані події
};

// Глобальні налаштування логування
const config = {
    enabled: true,                // Чи увімкнено логування
    minLevel: LOG_LEVELS.INFO,    // Мінімальний рівень для відображення
    showTimestamp: true,          // Показувати часову мітку
    showSource: true,             // Показувати джерело (модуль/функцію)
    enableConsole: true,          // Виводити в консоль браузера
    enableRemote: false,          // Надсилати логи на сервер
    remoteEndpoint: '',           // URL для відправки логів
    logToStorage: false,          // Зберігати логи в localStorage
    storageKey: 'app_logs',       // Ключ для localStorage
    maxStorageLogs: 1000,         // Максимальна кількість логів у сховищі
    environment: 'development',   // Середовище (development/production)
    formatOutput: true,           // Форматувати вивід у консоль
    silent: false,                // Повністю вимкнути логування
    moduleFilters: {}             // Фільтри для конкретних модулів
};

// Кеш логерів для різних модулів
const loggersCache = new Map();

// Буфер останніх логів
const logsBuffer = [];
const maxBufferSize = 1000;

/**
 * Основний клас логера
 */
class Logger {
    /**
     * Створення логера
     * @param {string} moduleName - Назва модуля
     * @param {Object} options - Додаткові налаштування
     */
    constructor(moduleName, options = {}) {
        this.moduleName = moduleName;
        this.options = { ...options };

        // Створюємо методи для кожного рівня логування
        Object.keys(LOG_LEVELS).forEach(level => {
            const levelValue = LOG_LEVELS[level];

            this[level.toLowerCase()] = (message, source = '', details = {}) => {
                this.log(levelValue, message, source, details);
            };
        });
    }

    /**
     * Логування повідомлення
     * @param {number} level - Рівень важливості
     * @param {string|Error} message - Повідомлення або об'єкт помилки
     * @param {string} source - Джерело (функція)
     * @param {Object} details - Додаткові дані
     */
    log(level, message, source = '', details = {}) {
        // Перевіряємо, чи логування увімкнено
        if (config.silent || !config.enabled) return;

        // Перевіряємо рівень логування
        if (level < config.minLevel) return;

        // Перевіряємо фільтр для модуля
        if (config.moduleFilters[this.moduleName] !== undefined &&
            level < config.moduleFilters[this.moduleName]) return;

        // Форматуємо повідомлення
        let formattedMessage = message;
        let errorObject = null;

        // Обробляємо об'єкт Error
        if (message instanceof Error) {
            formattedMessage = message.message;
            errorObject = message;

            // Додаємо стек в деталі
            if (!details.stack && message.stack) {
                details.stack = message.stack;
            }
        }

        // Формуємо запис логу
        const timestamp = new Date();
        const logEntry = {
            timestamp,
            timestampStr: timestamp.toISOString(),
            level,
            levelName: getLevelName(level),
            module: this.moduleName,
            source: source || 'unknown',
            message: formattedMessage,
            details: details || {},
            category: details.category || LOG_CATEGORIES.UNKNOWN
        };

        // Зберігаємо в буфер
        storeInBuffer(logEntry);

        // Виводимо в консоль
        if (config.enableConsole) {
            outputToConsole(logEntry, errorObject);
        }

        // Зберігаємо в localStorage
        if (config.logToStorage) {
            storeInLocalStorage(logEntry);
        }

        // Відправляємо на сервер
        if (config.enableRemote) {
            sendToRemoteEndpoint(logEntry);
        }

        // Генеруємо подію про новий лог
        dispatchLogEvent(logEntry);
    }

    /**
     * Спеціальний метод для сумісності з попереднім errorHandler
     */
    createModuleHandler(submodule) {
        // Створюємо підмодульний логер
        const submoduleLogger = new Logger(`${this.moduleName}.${submodule}`);

        // Повертаємо об'єкт, сумісний з інтерфейсом errorHandler
        return {
            info: (message, source, details) => submoduleLogger.info(message, source, details),
            warning: (message, source, details) => submoduleLogger.warn(message, source, details),
            error: (error, message, details) => {
                if (error instanceof Error) {
                    submoduleLogger.error(error, source, details);
                } else {
                    submoduleLogger.error(message, source, { ...details, customError: error });
                }
            },
            critical: (error, message, details) => {
                if (error instanceof Error) {
                    submoduleLogger.fatal(error, source, details);
                } else {
                    submoduleLogger.fatal(message, source, { ...details, customError: error });
                }
            }
        };
    }
}

/**
 * Отримання назви рівня за числовим значенням
 * @param {number} level - Числове значення рівня
 * @returns {string} Назва рівня
 */
function getLevelName(level) {
    const entries = Object.entries(LOG_LEVELS);
    for (const [name, value] of entries) {
        if (value === level) return name;
    }
    return 'UNKNOWN';
}

/**
 * Збереження логу в буфері
 * @param {Object} logEntry - Запис логу
 */
function storeInBuffer(logEntry) {
    logsBuffer.push(logEntry);

    // Обмежуємо розмір буфера
    if (logsBuffer.length > maxBufferSize) {
        logsBuffer.shift();
    }
}

/**
 * Виведення логу в консоль
 * @param {Object} logEntry - Запис логу
 * @param {Error|null} errorObject - Об'єкт помилки
 */
function outputToConsole(logEntry, errorObject) {
    // Визначаємо метод консолі
    let consoleMethod = 'log';

    switch (logEntry.level) {
        case LOG_LEVELS.TRACE:
        case LOG_LEVELS.DEBUG:
            consoleMethod = 'debug';
            break;
        case LOG_LEVELS.INFO:
            consoleMethod = 'info';
            break;
        case LOG_LEVELS.WARN:
            consoleMethod = 'warn';
            break;
        case LOG_LEVELS.ERROR:
        case LOG_LEVELS.FATAL:
            consoleMethod = 'error';
            break;
    }

    // Форматуємо повідомлення для консолі
    let prefix = '';

    if (config.showTimestamp) {
        const time = new Date(logEntry.timestamp).toTimeString().split(' ')[0];
        prefix += `[${time}] `;
    }

    prefix += `[${logEntry.levelName}] `;

    if (config.showSource) {
        prefix += `[${logEntry.module}${logEntry.source ? '.' + logEntry.source : ''}] `;
    }

    const finalMessage = `${prefix}${logEntry.message}`;

    // Виводимо в консоль
    if (config.formatOutput && window.console && typeof window.console[consoleMethod] === 'function') {
        if (Object.keys(logEntry.details).length > 0 || errorObject) {
            console[consoleMethod](finalMessage, errorObject || logEntry.details);
        } else {
            console[consoleMethod](finalMessage);
        }
    } else {
        // Запасний варіант
        console.log(finalMessage, logEntry.details);
    }
}

/**
 * Зберігання логу в localStorage
 * @param {Object} logEntry - Запис логу
 */
function storeInLocalStorage(logEntry) {
    try {
        // Отримуємо поточні логи
        let logs = [];
        const storedLogs = localStorage.getItem(config.storageKey);

        if (storedLogs) {
            logs = JSON.parse(storedLogs);
        }

        // Додаємо новий лог
        logs.push({
            t: logEntry.timestampStr,
            l: logEntry.levelName,
            m: logEntry.module,
            s: logEntry.source,
            msg: logEntry.message,
            c: logEntry.category
        });

        // Обмежуємо кількість логів
        if (logs.length > config.maxStorageLogs) {
            logs = logs.slice(-config.maxStorageLogs);
        }

        // Зберігаємо оновлений список
        localStorage.setItem(config.storageKey, JSON.stringify(logs));
    } catch (e) {
        // Ігноруємо помилки зі сховищем
        console.error('Помилка при збереженні логу в localStorage:', e);
    }
}

/**
 * Відправка логу на віддалений сервер
 * @param {Object} logEntry - Запис логу
 */
function sendToRemoteEndpoint(logEntry) {
    if (!config.remoteEndpoint) return;

    try {
        // Дані для відправки
        const data = {
            timestamp: logEntry.timestampStr,
            level: logEntry.levelName,
            module: logEntry.module,
            source: logEntry.source,
            message: logEntry.message,
            category: logEntry.category,
            details: logEntry.details,
            environment: config.environment
        };

        // Відправляємо асинхронно
        navigator.sendBeacon(config.remoteEndpoint, JSON.stringify(data));
    } catch (e) {
        // Ігноруємо помилки відправки
        console.error('Помилка при відправці логу на сервер:', e);
    }
}

/**
 * Генерація події про новий запис у лозі
 * @param {Object} logEntry - Запис логу
 */
function dispatchLogEvent(logEntry) {
    try {
        // Створюємо подію
        const event = new CustomEvent('app-log', {
            detail: {
                level: logEntry.levelName,
                module: logEntry.module,
                source: logEntry.source,
                message: logEntry.message,
                category: logEntry.category,
                timestamp: logEntry.timestamp
            }
        });

        // Відправляємо подію
        document.dispatchEvent(event);

        // Для критичних помилок додатково генеруємо специфічну подію
        if (logEntry.level >= LOG_LEVELS.ERROR) {
            const errorEvent = new CustomEvent('app-error', {
                detail: {
                    level: logEntry.levelName,
                    module: logEntry.module,
                    source: logEntry.source,
                    message: logEntry.message,
                    category: logEntry.category,
                    timestamp: logEntry.timestamp
                }
            });

            document.dispatchEvent(errorEvent);

            // Окрема подія для помилок критичного рівня
            if (logEntry.level >= LOG_LEVELS.FATAL) {
                const criticalEvent = new CustomEvent('app-error-critical', {
                    detail: {
                        level: logEntry.levelName,
                        module: logEntry.module,
                        source: logEntry.source,
                        message: logEntry.message,
                        category: logEntry.category,
                        timestamp: logEntry.timestamp
                    }
                });

                document.dispatchEvent(criticalEvent);
            }
        }
    } catch (e) {
        // Ігноруємо помилки генерації події
        console.error('Помилка при генерації події логу:', e);
    }
}

/**
 * Отримання логера для модуля
 * @param {string} moduleName - Назва модуля
 * @param {Object} options - Додаткові налаштування
 * @returns {Logger} Екземпляр логера
 */
export function getLogger(moduleName, options = {}) {
    // Перевіряємо кеш
    if (loggersCache.has(moduleName)) {
        return loggersCache.get(moduleName);
    }

    // Створюємо новий логер
    const logger = new Logger(moduleName, options);
    loggersCache.set(moduleName, logger);

    return logger;
}

/**
 * Оновлення глобальних налаштувань логування
 * @param {Object} newConfig - Нові налаштування
 */
export function configure(newConfig) {
    Object.assign(config, newConfig);

    // Додаткова обробка для продакшн режиму
    if (config.environment === 'production') {
        // У продакшн режимі вимикаємо менш важливі рівні за замовчуванням
        if (newConfig.minLevel === undefined) {
            config.minLevel = LOG_LEVELS.WARN;
        }
    }

    return { ...config }; // Повертаємо копію конфігурації
}

/**
 * Отримання всіх логів з буфера
 * @param {Object} filter - Фільтр для логів
 * @returns {Array} Відфільтровані логи
 */
export function getLogs(filter = {}) {
    let filteredLogs = [...logsBuffer];

    // Фільтрація за рівнем
    if (filter.minLevel !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.level >= filter.minLevel);
    }

    // Фільтрація за модулем
    if (filter.module) {
        filteredLogs = filteredLogs.filter(log => log.module === filter.module);
    }

    // Фільтрація за категорією
    if (filter.category) {
        filteredLogs = filteredLogs.filter(log => log.category === filter.category);
    }

    // Фільтрація за часовим діапазоном
    if (filter.startTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startTime);
    }

    if (filter.endTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endTime);
    }

    return filteredLogs;
}

/**
 * Очищення буфера логів
 */
export function clearLogs() {
    logsBuffer.length = 0;
}

/**
 * Очищення localStorage
 */
export function clearStoredLogs() {
    try {
        localStorage.removeItem(config.storageKey);
    } catch (e) {
        console.error('Помилка при очищенні логів зі сховища:', e);
    }
}

/**
 * Вимкнення всього логування
 */
export function disableLogging() {
    config.enabled = false;
}

/**
 * Увімкнення логування
 */
export function enableLogging() {
    config.enabled = true;
}

/**
 * Повний експорт логів в JSON
 * @returns {string} JSON з логами
 */
export function exportLogsToJson() {
    return JSON.stringify(logsBuffer);
}

/**
 * Створення сумісності зі старим errorHandler
 */
export const ERROR_LEVELS = {
    INFO: LOG_LEVELS.INFO,
    WARNING: LOG_LEVELS.WARN,
    ERROR: LOG_LEVELS.ERROR,
    CRITICAL: LOG_LEVELS.FATAL
};

export const ERROR_CATEGORIES = LOG_CATEGORIES;

// Для сумісності з попереднім errorHandler
export const errorHandler = {
    createModuleHandler: (moduleName) => {
        return getLogger(moduleName).createModuleHandler(moduleName);
    },

    getErrorHistory: (filter = {}) => {
        return getLogs(filter);
    }
};

// Створюємо глобальний логер для сумісності
export const logger = getLogger('App');

// Експортуємо за замовчуванням
export default {
    getLogger,
    configure,
    getLogs,
    clearLogs,
    clearStoredLogs,
    disableLogging,
    enableLogging,
    exportLogsToJson,
    LOG_LEVELS,
    LOG_CATEGORIES,
    ERROR_LEVELS,
    ERROR_CATEGORIES,
    errorHandler,
    logger
};