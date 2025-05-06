/**
 * Модульна система API для задач
 * Розділена на спеціалізовані модулі для кращої структури
 */

// Імпортуємо базові утиліти
import { API_PATHS, CONFIG } from '../config/task-types.js';
import errorHandler, { ERROR_LEVELS, ERROR_CATEGORIES } from '../utils/error-handler.js';
import cacheService from '../utils/CacheService.js';

// Створюємо обробник помилок для модуля
const moduleErrors = errorHandler.createModuleHandler('TaskApi');

// Частина 1: API Core - базова функціональність API
// ===================================================

/**
 * Базовий модуль API для взаємодії з сервером
 */
class ApiCore {
  constructor() {
    this.baseUrl = this.detectBaseUrl();
    this.defaultRequestOptions = {
      timeout: CONFIG.REQUEST_TIMEOUT,
      maxRetries: CONFIG.MAX_VERIFICATION_ATTEMPTS,
      retryDelay: CONFIG.RETRY_INTERVAL
    };
  }

  /**
   * Визначення базового URL API
   * @returns {string} Базовий URL API
   */
  detectBaseUrl() {
    try {
      if (typeof window !== 'undefined') {
        if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
          return window.WinixAPI.config.baseUrl.replace(/\/$/, '');
        }
        return window.location.origin;
      }
      return '';
    } catch (error) {
      moduleErrors.error(error, 'Помилка визначення базового URL', {
        category: ERROR_CATEGORIES.INIT
      });
      return '';
    }
  }

  /**
   * Отримання ID користувача
   * @returns {string|null} ID користувача
   */
  getUserId() {
    try {
      if (typeof window === 'undefined') return null;

      // Джерела ID
      const sources = [
        typeof window.getUserId === 'function' ? window.getUserId() : null,
        typeof window.WinixAPI?.getUserId === 'function' ? window.WinixAPI.getUserId() : null,
        window.localStorage?.getItem('telegram_user_id'),
        new URLSearchParams(window.location.search).get('id'),
        new URLSearchParams(window.location.search).get('user_id'),
        new URLSearchParams(window.location.search).get('telegram_id')
      ];

      // Перевіряємо кожне джерело
      for (const id of sources) {
        if (id && typeof id === 'string' && id !== 'undefined' && id !== 'null' && id.length > 3) {
          return id;
        }
      }

      moduleErrors.warning('ID користувача не знайдено', 'getUserId', {
        category: ERROR_CATEGORIES.AUTH
      });
      return null;
    } catch (error) {
      moduleErrors.error(error, 'Помилка отримання ID користувача', {
        category: ERROR_CATEGORIES.AUTH
      });
      return null;
    }
  }

  /**
   * Виконання запиту з повторними спробами
   * @param {string} url - URL запиту
   * @param {Object} options - Опції запиту
   * @returns {Promise<Object>} Результат запиту
   */
  async fetchWithRetry(url, options = {}) {
    const requestOptions = {
      ...this.defaultRequestOptions,
      ...options
    };

    let attempt = 0;
    let lastError = null;
    let delayMs = requestOptions.retryDelay;

    // Формуємо повний URL
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}/${url.replace(/^\//, '')}`;

    // Додаємо заголовки
    if (!requestOptions.headers) {
      requestOptions.headers = {};
    }

    if (!requestOptions.headers['Content-Type']) {
      requestOptions.headers['Content-Type'] = 'application/json';
    }

    // Додаємо ID користувача
    const userId = this.getUserId();
    if (userId) {
      requestOptions.headers['X-User-Id'] = userId;
    }

    // Спроби запиту
    while (attempt <= requestOptions.maxRetries) {
      try {
        attempt++;

        // Додаємо обробку таймауту
        const controller = new AbortController();
        const signal = controller.signal;
        const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);

        const response = await fetch(fullUrl, {
          ...requestOptions,
          signal
        });

        // Очищаємо таймер
        clearTimeout(timeoutId);

        // Парсимо відповідь
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          data = {
            status: response.ok ? 'success' : 'error',
            message: response.statusText
          };
        }

        // Додаємо HTTP статус
        data.httpStatus = response.status;

        if (response.ok) {
          return data;
        } else {
          // 4xx помилки (крім 429) не потребують повторних спроб
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(data.message || response.statusText || 'Помилка API');
          }

          // Інші помилки - повторюємо спроби
          lastError = new Error(data.message || response.statusText || 'Помилка API');
        }
      } catch (error) {
        lastError = error;

        // Перевіряємо на AbortError (таймаут)
        if (error.name === 'AbortError') {
          moduleErrors.warning(`Таймаут запиту до ${url}`, 'fetchWithRetry', {
            category: ERROR_CATEGORIES.TIMEOUT
          });
        } else {
          moduleErrors.warning(`Помилка запиту до ${url} (спроба ${attempt}/${requestOptions.maxRetries + 1})`, 'fetchWithRetry', {
            category: ERROR_CATEGORIES.API
          });
        }
      }

      // Якщо це остання спроба, виходимо з циклу
      if (attempt > requestOptions.maxRetries) {
        break;
      }

      // Затримка перед наступною спробою
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 1.5; // Збільшуємо затримку для наступної спроби
    }

    // Всі спроби невдалі
    moduleErrors.error(lastError, `Вичерпано всі спроби запиту до ${url}`, {
      category: ERROR_CATEGORIES.API
    });

    return {
      status: 'error',
      message: lastError?.message || 'Не вдалося виконати запит до сервера',
      error: lastError
    };
  }
}

// Частина 2: TaskDataApi - робота з даними завдань
// ===================================================

/**
 * API для роботи з даними завдань
 */
class TaskDataApi extends ApiCore {
  constructor() {
    super();
    this.taskCachePrefix = 'task_data_';
    this.progressCachePrefix = 'task_progress_';
  }

  /**
   * Завантаження всіх завдань з сервера
   * @returns {Promise<Object>} Дані завдань
   */
  async loadAllTasks() {
    try {
      // Спробуємо знайти в кеші
      const cachedTasks = cacheService.get('all_tasks_data');
      if (cachedTasks) {
        return cachedTasks;
      }

      const userId = this.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній'
        };
      }

      // Завантажуємо соціальні завдання
      const socialTasksPromise = this.fetchWithRetry(API_PATHS.TASKS.SOCIAL);

      // Завантажуємо лімітовані завдання
      const limitedTasksPromise = this.fetchWithRetry(API_PATHS.TASKS.LIMITED);

      // Завантажуємо партнерські завдання
      const partnerTasksPromise = this.fetchWithRetry(API_PATHS.TASKS.PARTNER);

      // Завантажуємо прогрес користувача
      const userProgressPromise = this.fetchWithRetry(API_PATHS.USER_PROGRESS.replace('{userId}', userId));

      // Чекаємо на виконання всіх запитів
      const [socialTasksResponse, limitedTasksResponse, partnerTasksResponse, userProgressResponse] =
        await Promise.all([socialTasksPromise, limitedTasksPromise, partnerTasksPromise, userProgressPromise]);

      // Формуємо загальний результат
      const result = {
        social: socialTasksResponse.data || [],
        limited: limitedTasksResponse.data || [],
        partner: partnerTasksResponse.data || [],
        userProgress: userProgressResponse.data || {}
      };

      // Кешуємо результат
      cacheService.set('all_tasks_data', result, {
        ttl: 60000, // 1 хвилина
        tags: ['tasks', 'api']
      });

      return result;
    } catch (error) {
      moduleErrors.error(error, 'Помилка завантаження завдань', {
        category: ERROR_CATEGORIES.API
      });

      return {
        status: 'error',
        message: 'Не вдалося завантажити завдання',
        error: error.message
      };
    }
  }

  /**
   * Отримання даних одного завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Дані завдання
   */
  async getTaskData(taskId) {
    try {
      // Перевіряємо у кеші
      const cacheKey = `${this.taskCachePrefix}${taskId}`;
      const cachedTask = cacheService.get(cacheKey);
      if (cachedTask) {
        return cachedTask;
      }

      // Завантажуємо з сервера
      const response = await this.fetchWithRetry(`tasks/${taskId}`);

      if (response.status === 'success' && response.data) {
        // Кешуємо результат
        cacheService.set(cacheKey, response.data, {
          ttl: 120000, // 2 хвилини
          tags: ['tasks', `task_${taskId}`]
        });

        return response.data;
      }

      return null;
    } catch (error) {
      moduleErrors.error(error, `Помилка отримання даних завдання ${taskId}`, {
        category: ERROR_CATEGORIES.API,
        details: { taskId }
      });

      return null;
    }
  }

  /**
   * Отримання прогресу завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Прогрес завдання
   */
  async getTaskProgress(taskId) {
    try {
      // Перевіряємо у кеші
      const cacheKey = `${this.progressCachePrefix}${taskId}`;
      const cachedProgress = cacheService.get(cacheKey);
      if (cachedProgress) {
        return cachedProgress;
      }

      const userId = this.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній'
        };
      }

      // Завантажуємо з сервера
      const response = await this.fetchWithRetry(`quests/tasks/${taskId}/progress/${userId}`);

      if (response.status === 'success' && response.data) {
        // Кешуємо результат
        cacheService.set(cacheKey, response.data, {
          ttl: 30000, // 30 секунд
          tags: ['progress', `task_${taskId}`]
        });

        return response.data;
      }

      return null;
    } catch (error) {
      moduleErrors.error(error, `Помилка отримання прогресу завдання ${taskId}`, {
        category: ERROR_CATEGORIES.API,
        details: { taskId }
      });

      return null;
    }
  }
}

// Частина 3: TaskActionApi - виконання дій з завданнями
// ===================================================

/**
 * API для виконання дій з завданнями
 */
class TaskActionApi extends ApiCore {
  constructor() {
    super();
  }

  /**
   * Початок виконання завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат операції
   */
  async startTask(taskId) {
    try {
      const userId = this.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній'
        };
      }

      // Формуємо URL для запиту
      const url = API_PATHS.START_TASK.replace('{taskId}', taskId);

      // Виконуємо запит
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          task_id: taskId,
          timestamp: Date.now()
        })
      });

      // Очищаємо кеш прогресу для цього завдання
      cacheService.removeByTags([`task_${taskId}`]);

      return response;
    } catch (error) {
      moduleErrors.error(error, `Помилка запуску завдання ${taskId}`, {
        category: ERROR_CATEGORIES.API,
        details: { taskId }
      });

      return {
        status: 'error',
        message: 'Не вдалося запустити завдання',
        error: error.message
      };
    }
  }

  /**
   * Верифікація виконання завдання
   * @param {string} taskId - ID завдання
   * @param {Object} verificationData - Дані для верифікації
   * @returns {Promise<Object>} Результат верифікації
   */
  async verifyTask(taskId, verificationData = {}) {
    try {
      const userId = this.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній'
        };
      }

      // Формуємо URL для запиту
      const url = API_PATHS.VERIFICATION.replace('{taskId}', taskId);

      // Виконуємо запит
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          task_id: taskId,
          timestamp: Date.now(),
          ...verificationData
        })
      });

      // Очищаємо кеш завдань і прогресу
      cacheService.removeByTags([`task_${taskId}`]);

      return response;
    } catch (error) {
      moduleErrors.error(error, `Помилка верифікації завдання ${taskId}`, {
        category: ERROR_CATEGORIES.API,
        details: { taskId }
      });

      return {
        status: 'error',
        message: 'Не вдалося верифікувати завдання',
        error: error.message
      };
    }
  }
}

// Основний клас API, який об'єднує всі модулі
// ===================================================

/**
 * Основний клас API для завдань
 */
class TaskApi {
  constructor() {
    // Створюємо екземпляри модулів
    this.core = new ApiCore();
    this.data = new TaskDataApi();
    this.actions = new TaskActionApi();

    // Методи для зворотної сумісності
    this.baseUrl = this.core.baseUrl;
    this.fetchWithRetry = this.core.fetchWithRetry.bind(this.core);
    this.getUserId = this.core.getUserId.bind(this.core);

    // Методи роботи з даними
    this.loadAllTasks = this.data.loadAllTasks.bind(this.data);
    this.getTaskData = this.data.getTaskData.bind(this.data);
    this.getTaskProgress = this.data.getTaskProgress.bind(this.data);

    // Методи для дій
    this.startTask = this.actions.startTask.bind(this.actions);
    this.verifyTask = this.actions.verifyTask.bind(this.actions);
  }
}

// Створюємо і експортуємо єдиний екземпляр API
const taskApi = new TaskApi();
export default taskApi;