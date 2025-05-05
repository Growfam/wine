window.ErrorHandler = (function() {
  // Типи помилок
  const ERROR_TYPES = {
    NETWORK: 'network_error',
    TIMEOUT: 'timeout_error',
    AUTH: 'auth_error',
    RATE_LIMIT: 'rate_limit_error',
    CORS: 'cors_error',
    UNKNOWN: 'unknown_error'
  };

  // Конфігурація
  const config = {
    retryEnabled: true,
    maxRetries: 3,
    retryDelay: 2000,
    retryMultiplier: 1.5
  };

  /**
   * Класифікація помилки
   * @param {Error} error - Об'єкт помилки
   * @returns {string} Тип помилки
   */
  function classifyError(error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return ERROR_TYPES.TIMEOUT;
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return ERROR_TYPES.NETWORK;
    }

    if (error.status === 401 || error.status === 403) {
      return ERROR_TYPES.AUTH;
    }

    if (error.status === 429) {
      return ERROR_TYPES.RATE_LIMIT;
    }

    if (error.message.includes('CORS')) {
      return ERROR_TYPES.CORS;
    }

    return ERROR_TYPES.UNKNOWN;
  }

  /**
   * Отримання повідомлення для користувача
   * @param {string} errorType - Тип помилки
   * @returns {string} Повідомлення
   */
  function getUserMessage(errorType) {
    switch (errorType) {
      case ERROR_TYPES.NETWORK:
        return 'Проблема з мережевим з\'єднанням. Перевірте підключення до Інтернету та спробуйте ще раз.';
      case ERROR_TYPES.TIMEOUT:
        return 'Перевищено час очікування відповіді від сервера. Перевірте з\'єднання та спробуйте ще раз.';
      case ERROR_TYPES.AUTH:
        return 'Помилка авторизації. Оновіть сторінку та спробуйте знову.';
      case ERROR_TYPES.RATE_LIMIT:
        return 'Занадто багато запитів. Будь ласка, спробуйте пізніше.';
      case ERROR_TYPES.CORS:
        return 'Проблема з доступом до сервера. Спробуйте оновити сторінку або використати інший браузер.';
      default:
        return 'Сталася помилка. Спробуйте пізніше.';
    }
  }

  /**
   * Виконання запиту з автоматичними повторними спробами
   * @param {Function} requestFunction - Функція запиту
   * @param {Object} options - Параметри
   * @returns {Promise<any>} Результат запиту
   */
  async function executeWithRetry(requestFunction, options = {}) {
    const {
      maxRetries = config.maxRetries,
      retryDelay = config.retryDelay,
      retryMultiplier = config.retryMultiplier,
      shouldRetry = null
    } = options;

    let lastError = null;
    let attempts = 0;

    while (attempts <= maxRetries) {
      try {
        attempts++;
        return await requestFunction();
      } catch (error) {
        lastError = error;

        // Визначаємо, чи потрібно повторювати спробу
        const errorType = classifyError(error);
        const shouldRetryDefault = [
          ERROR_TYPES.NETWORK,
          ERROR_TYPES.TIMEOUT,
          ERROR_TYPES.CORS
        ].includes(errorType);

        const needRetry = typeof shouldRetry === 'function'
          ? shouldRetry(error, attempts)
          : shouldRetryDefault;

        if (!needRetry || attempts > maxRetries) {
          break;
        }

        // Затримка перед наступною спробою
        const delay = retryDelay * Math.pow(retryMultiplier, attempts - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Створюємо стандартизований об'єкт помилки
    const errorType = classifyError(lastError);
    throw {
      success: false,
      status: errorType,
      message: getUserMessage(errorType),
      error: lastError.message,
      original: lastError,
      attempts
    };
  }

  /**
   * Обробка помилки та повернення стандартизованого результату
   * @param {Error} error - Помилка
   * @param {Object} context - Контекст помилки
   * @returns {Object} Стандартизований результат
   */
  function handleError(error, context = {}) {
    const errorType = classifyError(error);

    return {
      success: false,
      status: errorType,
      message: getUserMessage(errorType),
      error: error.message,
      context
    };
  }

  return {
    executeWithRetry,
    handleError,
    classifyError,
    getUserMessage,
    ERROR_TYPES
  };
})();