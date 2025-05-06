/**
 * Сервіс верифікації виконання завдань
 *
 * Відповідає за:
 * - Перевірку виконання завдань
 * - Обробку результатів верифікації
 * - Кешування результатів
 */

import { VERIFICATION_STATUS, CONFIG, TASK_TYPES, SOCIAL_NETWORKS } from '../config/task-types.js';
import taskApi from './task-api.js';
import taskStore from './task-store.js';
import cacheService from '../utils/CacheService.js';
import errorHandler, { ERROR_LEVELS, ERROR_CATEGORIES } from '../utils/error-handler.js';

// Створюємо обробник помилок для модуля
const moduleErrors = errorHandler.createModuleHandler('TaskVerification');

// Ключі для кешу
const CACHE_KEYS = {
  VERIFICATION_PREFIX: 'verification_',
  VERIFICATION_RESULT: 'verification_result_',
  TASK_TYPE: 'task_type_'
};

// Теги для кешу
const CACHE_TAGS = {
  VERIFICATION: 'verification',
  TASK: 'task',
  RESULT: 'result',
  SOCIAL: 'social',
  LIMITED: 'limited',
  PARTNER: 'partner'
};

class TaskVerification {
  constructor() {
    // Стан процесу верифікації
    this.state = {
      // Час останньої перевірки для кожного завдання
      lastVerificationTime: {},

      // Кількість спроб верифікації для кожного завдання
      verificationAttempts: {},

      // Поточні активні перевірки
      activeVerifications: {},

      // Реєстр оброблених подій
      processedEvents: {}
    };

    // Конфігурація
    this.config = {
      // Час життя кешу (мс)
      cacheTTL: CONFIG.CACHE_TTL,

      // Тривалість затримки між перевірками (мс)
      throttleDelay: CONFIG.THROTTLE_DELAY,

      // Чи блокувати повторні запити на перевірку
      blockRepeatedRequests: true,

      // Максимальна кількість спроб верифікації
      maxVerificationAttempts: CONFIG.MAX_VERIFICATION_ATTEMPTS
    };
  }

  /**
   * Перевірка виконання завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат перевірки
   */
  async verifyTask(taskId) {
    try {
      // Створюємо унікальний ідентифікатор для цієї перевірки
      const verificationId = `verification_${taskId}_${Date.now()}`;

      // Показуємо індикатор завантаження
      this.showVerificationLoader(taskId);

      // Перевіряємо, чи не перевіряється вже це завдання
      if (this.config.blockRepeatedRequests && this.isVerificationInProgress(taskId)) {
        this.hideVerificationLoader(taskId);
        moduleErrors.info(`Завдання ${taskId} вже перевіряється`, 'verifyTask', {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId, verificationId }
        });

        return {
          success: false,
          status: VERIFICATION_STATUS.PENDING,
          message: 'Перевірка вже виконується. Зачекайте.'
        };
      }

      // Проміжок часу з останньої перевірки
      const lastVerificationInterval = Date.now() - (this.state.lastVerificationTime[taskId] || 0);

      // Перевіряємо чи не занадто часто перевіряється
      if (lastVerificationInterval < this.config.throttleDelay) {
        const waitTime = Math.ceil((this.config.throttleDelay - lastVerificationInterval) / 1000);

        this.hideVerificationLoader(taskId);
        moduleErrors.info(`Занадто часті запити на перевірку для завдання ${taskId}`, 'verifyTask', {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId, lastVerificationInterval, throttleDelay: this.config.throttleDelay }
        });

        return {
          success: false,
          status: VERIFICATION_STATUS.FAILURE,
          message: `Зачекайте ${waitTime} сек. перед новою спробою перевірки.`
        };
      }

      // Перевіряємо кількість спроб
      if (this.config.maxVerificationAttempts > 0) {
        this.state.verificationAttempts[taskId] = (this.state.verificationAttempts[taskId] || 0) + 1;

        if (this.state.verificationAttempts[taskId] > this.config.maxVerificationAttempts) {
          this.hideVerificationLoader(taskId);

          moduleErrors.warning(`Перевищено максимальну кількість спроб для завдання ${taskId}`, 'verifyTask', {
            category: ERROR_CATEGORIES.LOGIC,
            details: {
              taskId,
              attempts: this.state.verificationAttempts[taskId],
              maxAttempts: this.config.maxVerificationAttempts
            }
          });

          return {
            success: false,
            status: VERIFICATION_STATUS.FAILURE,
            message: `Перевищено максимальну кількість спроб (${this.config.maxVerificationAttempts}). Спробуйте пізніше.`
          };
        }
      }

      // Перевіряємо наявність кешованого результату
      const cachedResult = this.getCachedResult(taskId);
      if (cachedResult) {
        // Використовуємо кешований успішний результат
        if (cachedResult.success) {
          this.hideVerificationLoader(taskId);
          moduleErrors.info(`Використано кешований результат для завдання ${taskId}`, 'verifyTask', {
            category: ERROR_CATEGORIES.LOGIC,
            details: { taskId, cachedResult }
          });

          // Відправляємо подію про результат перевірки
          this.dispatchVerificationEvent(taskId, cachedResult, `${verificationId}_cached`);

          return cachedResult;
        }
      }

      // Позначаємо завдання як таке, що перевіряється
      this.state.activeVerifications[taskId] = true;
      this.state.lastVerificationTime[taskId] = Date.now();

      // Отримуємо тип завдання
      const task = taskStore.findTaskById(taskId);
      const taskType = task ? task.type : this.getTaskType(taskId);

      // Виконуємо специфічну для типу перевірку
      let result;

      try {
        switch (taskType) {
          case TASK_TYPES.SOCIAL:
            result = await this.verifySocialTask(taskId);
            break;
          case TASK_TYPES.LIMITED:
            result = await this.verifyLimitedTask(taskId);
            break;
          case TASK_TYPES.PARTNER:
            result = await this.verifyPartnerTask(taskId);
            break;
          default:
            result = await this.verifyGenericTask(taskId);
        }
      } catch (error) {
        // Обробка помилок верифікації
        result = this.handleVerificationError(error, taskId);
      }

      // Приховуємо індикатор завантаження
      this.hideVerificationLoader(taskId);

      // Оновлюємо кеш
      this.cacheResult(taskId, result);

      // Видаляємо завдання з активних перевірок
      delete this.state.activeVerifications[taskId];

      // Генеруємо подію про результат перевірки
      this.dispatchVerificationEvent(taskId, result, verificationId);

      return result;
    } catch (unexpectedError) {
      moduleErrors.critical(unexpectedError, `Критична помилка при верифікації завдання ${taskId}`, {
        category: ERROR_CATEGORIES.UNKNOWN,
        details: { taskId }
      });

      // Приховуємо індикатор завантаження
      this.hideVerificationLoader(taskId);

      // Видаляємо завдання з активних перевірок
      delete this.state.activeVerifications[taskId];

      // Формуємо результат помилки
      const errorResult = {
        success: false,
        status: VERIFICATION_STATUS.ERROR,
        message: 'Сталася неочікувана помилка під час перевірки завдання. Спробуйте пізніше.',
        error: unexpectedError.message
      };

      // Створюємо унікальний ідентифікатор події
      const errorEventId = `verification_error_${taskId}_${Date.now()}`;

      // Генеруємо подію про помилку
      this.dispatchVerificationEvent(taskId, errorResult, errorEventId);

      return errorResult;
    }
  }

  /**
   * Перевірка соціального завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат перевірки
   */
  async verifySocialTask(taskId) {
    try {
      // Отримуємо дані завдання
      const task = taskStore.findTaskById(taskId);

      if (!task) {
        const noDataError = new Error('Не вдалося отримати дані завдання');
        moduleErrors.error(noDataError, `Відсутні дані для соціального завдання ${taskId}`, {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId }
        });

        return {
          success: false,
          status: VERIFICATION_STATUS.ERROR,
          message: 'Не вдалося отримати дані завдання'
        };
      }

      // Визначаємо тип соціальної мережі
      const socialType = task.platform || this.determineSocialNetwork(task);

      // Додаткова перевірка соціальної мережі
      if (socialType) {
        // Додаткові дані для верифікації соціального завдання
        const verificationData = {
          platform: socialType.toLowerCase(),
          verification_type: 'social',
          task_data: {
            platform: socialType.toLowerCase(),
            action_type: task.action_type || 'visit'
          }
        };

        // Запит до API для верифікації
        return await this.performApiVerification(taskId, verificationData);
      }

      // Якщо тип соціальної мережі не визначено, використовуємо стандартну перевірку
      moduleErrors.warning(`Не вдалося визначити тип соціальної мережі для завдання ${taskId}`, 'verifySocialTask', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId, task }
      });

      return await this.verifyGenericTask(taskId);
    } catch (error) {
      moduleErrors.error(error, `Помилка при верифікації соціального завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId }
      });

      return this.handleVerificationError(error, taskId);
    }
  }

  /**
   * Перевірка лімітованого завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат перевірки
   */
  async verifyLimitedTask(taskId) {
    try {
      // Отримуємо дані завдання
      const task = taskStore.findTaskById(taskId);

      if (!task) {
        const noDataError = new Error('Не вдалося отримати дані завдання');
        moduleErrors.error(noDataError, `Відсутні дані для лімітованого завдання ${taskId}`, {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId }
        });

        return {
          success: false,
          status: VERIFICATION_STATUS.ERROR,
          message: 'Не вдалося отримати дані завдання'
        };
      }

      // Перевіряємо термін дії завдання
      if (task.end_date) {
        const endDate = new Date(task.end_date);
        const now = new Date();

        if (endDate <= now) {
          moduleErrors.info(`Термін виконання завдання ${taskId} закінчився`, 'verifyLimitedTask', {
            category: ERROR_CATEGORIES.LOGIC,
            details: { taskId, endDate: endDate.toISOString(), now: now.toISOString() }
          });

          return {
            success: false,
            status: VERIFICATION_STATUS.FAILURE,
            message: 'Термін виконання цього завдання закінчився'
          };
        }
      }

      // Додаткові дані для перевірки лімітованого завдання
      const verificationData = {
        verification_type: 'limited',
        task_data: {
          action_type: task.action_type || 'visit',
          timestamp: Date.now()
        }
      };

      // Запит до API для верифікації
      return await this.performApiVerification(taskId, verificationData);
    } catch (error) {
      moduleErrors.error(error, `Помилка при верифікації лімітованого завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId }
      });

      return this.handleVerificationError(error, taskId);
    }
  }

  /**
   * Перевірка партнерського завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат перевірки
   */
  async verifyPartnerTask(taskId) {
    try {
      // Отримуємо дані завдання
      const task = taskStore.findTaskById(taskId);

      if (!task) {
        const noDataError = new Error('Не вдалося отримати дані завдання');
        moduleErrors.error(noDataError, `Відсутні дані для партнерського завдання ${taskId}`, {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId }
        });

        return {
          success: false,
          status: VERIFICATION_STATUS.ERROR,
          message: 'Не вдалося отримати дані завдання'
        };
      }

      // Додаткові дані для перевірки партнерського завдання
      const verificationData = {
        verification_type: 'partner',
        task_data: {
          partner_name: task.partner_name || '',
          action_type: task.action_type || 'visit',
          timestamp: Date.now()
        }
      };

      // Запит до API для верифікації
      return await this.performApiVerification(taskId, verificationData);
    } catch (error) {
      moduleErrors.error(error, `Помилка при верифікації партнерського завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId }
      });

      return this.handleVerificationError(error, taskId);
    }
  }

  /**
   * Перевірка загального завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат перевірки
   */
  async verifyGenericTask(taskId) {
    try {
      // Отримуємо дані завдання
      const task = taskStore.findTaskById(taskId);

      // Додаткові дані для перевірки
      const verificationData = {
        verification_type: 'generic',
        task_data: {
          action_type: task?.action_type || 'generic',
          timestamp: Date.now()
        }
      };

      // Запит до API для верифікації
      return await this.performApiVerification(taskId, verificationData);
    } catch (error) {
      moduleErrors.error(error, `Помилка при верифікації загального завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId }
      });

      return this.handleVerificationError(error, taskId);
    }
  }

  /**
   * Виконання API запиту для верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} verificationData - Дані для верифікації
   * @returns {Promise<Object>} Результат верифікації
   */
  async performApiVerification(taskId, verificationData = {}) {
    try {
      // Викликаємо API для верифікації
      const response = await taskApi.verifyTask(taskId, verificationData);

      // Обробляємо відповідь
      if (response.status === 'success') {
        moduleErrors.info(`Завдання ${taskId} успішно виконано`, 'performApiVerification', {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId, verificationData }
        });

        return {
          success: true,
          status: VERIFICATION_STATUS.SUCCESS,
          message: response.message || 'Завдання успішно виконано!',
          reward: response.data?.reward || null,
          verification_details: response.data?.verification || {},
          response_time_ms: Date.now() - this.state.lastVerificationTime[taskId]
        };
      } else {
        moduleErrors.warning(`Верифікація завдання ${taskId} невдала`, 'performApiVerification', {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId, response, verificationData }
        });

        return {
          success: false,
          status: VERIFICATION_STATUS.FAILURE,
          message: response.message || response.error || 'Не вдалося перевірити виконання завдання',
          error: response.error
        };
      }
    } catch (error) {
      return this.handleVerificationError(error, taskId);
    }
  }

  /**
   * Обробка помилки верифікації
   * @param {Error} error - Об'єкт помилки
   * @param {string} taskId - ID завдання
   * @returns {Object} Оброблений результат помилки
   */
  handleVerificationError(error, taskId) {
    moduleErrors.error(error, `Помилка при верифікації завдання ${taskId}`, {
      category: ERROR_CATEGORIES.API,
      details: { taskId }
    });

    // Класифікуємо помилку
    let status = VERIFICATION_STATUS.ERROR;
    let message = 'Сталася помилка під час перевірки завдання. Спробуйте пізніше.';
    let errorCategory = ERROR_CATEGORIES.UNKNOWN;

    // Перевіряємо тип помилки
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      status = VERIFICATION_STATUS.TIMEOUT;
      message = 'Перевищено час очікування відповіді від сервера. Перевірте з\'єднання та спробуйте ще раз.';
      errorCategory = ERROR_CATEGORIES.TIMEOUT;
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      status = VERIFICATION_STATUS.NETWORK_ERROR;
      message = 'Проблема з мережевим з\'єднанням. Перевірте підключення до Інтернету та спробуйте ще раз.';
      errorCategory = ERROR_CATEGORIES.NETWORK;
    } else if (error.status === 401 || error.status === 403) {
      message = 'Помилка авторизації. Оновіть сторінку та спробуйте знову.';
      errorCategory = ERROR_CATEGORIES.AUTH;
    } else if (error.status === 429) {
      message = 'Занадто багато запитів. Будь ласка, спробуйте пізніше.';
      errorCategory = ERROR_CATEGORIES.API;
    } else if (error.message && error.message.includes('CORS')) {
      status = VERIFICATION_STATUS.NETWORK_ERROR;
      message = 'Проблема з доступом до сервера. Спробуйте оновити сторінку або використати інший браузер.';
      errorCategory = ERROR_CATEGORIES.NETWORK;
    }

    // Додаємо деталізовану інформацію про помилку
    moduleErrors.error(error, message, {
      category: errorCategory,
      details: { taskId, status }
    });

    return {
      success: false,
      status: status,
      message: message,
      error: error.message,
      taskId: taskId
    };
  }

  /**
   * Визначення типу соціальної мережі
   * @param {Object} task - Дані завдання
   * @returns {string|null} Тип соціальної мережі
   */
  determineSocialNetwork(task) {
    if (!task || (!task.action_url && !task.channel_url)) return null;

    try {
      const url = (task.channel_url || task.action_url).toLowerCase();
      const title = (task.title || '').toLowerCase();
      const description = (task.description || '').toLowerCase();

      if (url.includes('t.me/') || url.includes('telegram.') ||
          title.includes('telegram') || description.includes('telegram')) {
        return SOCIAL_NETWORKS.TELEGRAM;
      }

      if (url.includes('twitter.') || url.includes('x.com') ||
          title.includes('twitter') || description.includes('twitter')) {
        return SOCIAL_NETWORKS.TWITTER;
      }

      if (url.includes('discord.') ||
          title.includes('discord') || description.includes('discord')) {
        return SOCIAL_NETWORKS.DISCORD;
      }

      if (url.includes('facebook.') || url.includes('fb.') ||
          title.includes('facebook') || description.includes('facebook')) {
        return SOCIAL_NETWORKS.FACEBOOK;
      }

      return null;
    } catch (error) {
      moduleErrors.warning(error, 'Помилка при визначенні типу соціальної мережі', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { task }
      });
      return null;
    }
  }

  /**
   * Отримання типу завдання
   * @param {string} taskId - ID завдання
   * @returns {string} Тип завдання
   */
  getTaskType(taskId) {
    try {
      // Перевіряємо кеш спочатку
      const cachedType = cacheService.get(`${CACHE_KEYS.TASK_TYPE}${taskId}`);
      if (cachedType) {
        return cachedType;
      }

      // Спочатку використовуємо сховище завдань
      const task = taskStore.findTaskById(taskId);
      if (task) {
        // Кешуємо тип
        cacheService.set(`${CACHE_KEYS.TASK_TYPE}${taskId}`, task.type, {
          tags: [CACHE_TAGS.TASK, 'type']
        });
        return task.type;
      }

      // Визначаємо тип за ID
      let determinedType;
      if (taskId.startsWith('social_')) {
        determinedType = TASK_TYPES.SOCIAL;
      } else if (taskId.startsWith('limited_')) {
        determinedType = TASK_TYPES.LIMITED;
      } else if (taskId.startsWith('partner_')) {
        determinedType = TASK_TYPES.PARTNER;
      } else if (taskId.startsWith('referral_')) {
        determinedType = TASK_TYPES.REFERRAL;
      } else {
        // Спробуємо визначити тип за DOM
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (taskElement) {
          const taskType = taskElement.dataset.taskType;
          if (taskType) {
            determinedType = taskType;
          } else {
            // Визначаємо тип за контейнером
            const socialContainer = document.getElementById('social-tasks-container');
            const limitedContainer = document.getElementById('limited-tasks-container');
            const partnersContainer = document.getElementById('partners-tasks-container');

            if (socialContainer && socialContainer.contains(taskElement)) {
              determinedType = TASK_TYPES.SOCIAL;
            } else if (limitedContainer && limitedContainer.contains(taskElement)) {
              determinedType = TASK_TYPES.LIMITED;
            } else if (partnersContainer && partnersContainer.contains(taskElement)) {
              determinedType = TASK_TYPES.PARTNER;
            } else {
              determinedType = 'unknown';
            }
          }
        } else {
          determinedType = 'unknown';
        }
      }

      // Кешуємо знайдений тип
      if (determinedType !== 'unknown') {
        cacheService.set(`${CACHE_KEYS.TASK_TYPE}${taskId}`, determinedType, {
          tags: [CACHE_TAGS.TASK, 'type']
        });
      }

      if (determinedType === 'unknown') {
        moduleErrors.warning(`Не вдалося визначити тип завдання ${taskId}`, 'getTaskType', {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId }
        });
      }

      return determinedType;
    } catch (error) {
      moduleErrors.error(error, `Помилка при визначенні типу завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId }
      });
      return 'unknown';
    }
  }

  /**
   * Показати індикатор завантаження верифікації
   * @param {string} taskId - ID завдання
   */
  showVerificationLoader(taskId) {
    try {
      const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
      if (!taskElement) return;

      const actionElement = taskElement.querySelector('.task-action');
      if (actionElement) {
        // Додаємо клас стану завантаження
        actionElement.classList.add('loading');

        // Зберігаємо оригінальний вміст
        const originalContent = actionElement.innerHTML;
        actionElement.setAttribute('data-original-content', originalContent);

        // Замінюємо на лоадер
        actionElement.innerHTML = `
          <div class="loading-indicator">
            <div class="spinner"></div>
            <span data-lang-key="earn.verifying">Перевірка...</span>
          </div>
        `;
      }
    } catch (error) {
      moduleErrors.warning(error, `Помилка відображення індикатора завантаження для завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId }
      });
    }
  }

  /**
   * Приховати індикатор завантаження верифікації
   * @param {string} taskId - ID завдання
   */
  hideVerificationLoader(taskId) {
    try {
      const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
      if (!taskElement) return;

      const actionElement = taskElement.querySelector('.task-action');
      if (actionElement) {
        // Видаляємо клас стану завантаження
        actionElement.classList.remove('loading');

        // Відновлюємо оригінальний вміст
        const originalContent = actionElement.getAttribute('data-original-content');
        if (originalContent) {
          actionElement.innerHTML = originalContent;
          actionElement.removeAttribute('data-original-content');
        }
      }
    } catch (error) {
      moduleErrors.warning(error, `Помилка приховування індикатора завантаження для завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId }
      });
    }
  }

  /**
   * Перевірка, чи вже виконується верифікація завдання
   * @param {string} taskId - ID завдання
   * @returns {boolean} Чи виконується верифікація
   */
  isVerificationInProgress(taskId) {
    return !!this.state.activeVerifications[taskId];
  }

  /**
   * Перевірка, чи є кешований результат
   * @param {string} taskId - ID завдання
   * @returns {Object|null} Кешований результат
   */
  getCachedResult(taskId) {
    try {
      return cacheService.get(`${CACHE_KEYS.VERIFICATION_RESULT}${taskId}`);
    } catch (error) {
      moduleErrors.warning(error, `Помилка отримання кешу для завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId }
      });
      return null;
    }
  }

  /**
   * Кешування результату
   * @param {string} taskId - ID завдання
   * @param {Object} result - Результат перевірки
   */
  cacheResult(taskId, result) {
    try {
      // Визначаємо теги для кешу
      const taskType = this.getTaskType(taskId);
      const tags = [CACHE_TAGS.VERIFICATION, CACHE_TAGS.RESULT];

      // Додаємо тег типу завдання
      if (taskType === TASK_TYPES.SOCIAL) {
        tags.push(CACHE_TAGS.SOCIAL);
      } else if (taskType === TASK_TYPES.LIMITED) {
        tags.push(CACHE_TAGS.LIMITED);
      } else if (taskType === TASK_TYPES.PARTNER) {
        tags.push(CACHE_TAGS.PARTNER);
      }

      // Визначаємо час життя кешу в залежності від статусу
      let cacheTtl = this.config.cacheTTL; // За замовчуванням

      // Для успішних результатів - довший час життя
      if (result.success) {
        cacheTtl = this.config.cacheTTL * 2; // Подвоюємо час
      } else if (result.status === VERIFICATION_STATUS.FAILURE) {
        cacheTtl = Math.min(this.config.cacheTTL, 300000); // Максимум 5 хвилин для помилок
      }

      // Зберігаємо результат в кеш
      cacheService.set(`${CACHE_KEYS.VERIFICATION_RESULT}${taskId}`, result, {
        ttl: cacheTtl,
        tags
      });
    } catch (error) {
      moduleErrors.warning(error, `Помилка кешування результату для завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId, result }
      });
    }
  }

  /**
   * Відправлення події про результат верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} result - Результат перевірки
   * @param {string} eventId - Унікальний ідентифікатор події
   */
  dispatchVerificationEvent(taskId, result, eventId) {
    try {
      // Перевіряємо, чи не був цей eventId вже оброблений
      if (eventId && this.state.processedEvents[eventId]) {
        moduleErrors.info(`Подія ${eventId} вже була оброблена`, 'dispatchVerificationEvent', {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId, eventId }
        });
        return;
      }

      // Зберігаємо ідентифікатор події як оброблений
      if (eventId) {
        this.state.processedEvents[eventId] = Date.now();

        // Кешуємо оброблені події
        cacheService.set(`processed_event_${eventId}`, {
          taskId,
          timestamp: Date.now()
        }, {
          ttl: 3600000, // 1 година
          tags: [CACHE_TAGS.VERIFICATION, 'events']
        });
      }

      // Додаємо таймстамп до результату
      result.timestamp = Date.now();

      // Відправляємо подію про результат верифікації
      document.dispatchEvent(new CustomEvent('task-verification-result', {
        detail: {
          taskId,
          result,
          timestamp: Date.now(),
          eventId
        }
      }));

      // Якщо верифікація була успішною
      if (result.success) {
        // Отримуємо цільове значення завдання
        const targetValue = this.getTaskTargetValue(taskId);

        // Оновлюємо прогрес у сховищі
        try {
          taskStore.setTaskProgress(taskId, {
            status: 'completed',
            progress_value: targetValue,
            completion_date: new Date().toISOString()
          });
        } catch (storeError) {
          moduleErrors.error(storeError, `Помилка оновлення прогресу для завдання ${taskId}`, {
            category: ERROR_CATEGORIES.LOGIC,
            details: { taskId, targetValue }
          });
        }

        // Затримка перед відправкою події завершення завдання
        setTimeout(() => {
          try {
            // Відправляємо подію про завершення завдання
            document.dispatchEvent(new CustomEvent('task-completed', {
              detail: {
                taskId,
                reward: result.reward,
                timestamp: Date.now(),
                eventId
              }
            }));
          } catch (eventError) {
            moduleErrors.error(eventError, `Помилка відправки події завершення завдання ${taskId}`, {
              category: ERROR_CATEGORIES.LOGIC,
              details: { taskId, eventId }
            });
          }
        }, 50);
      }
    } catch (error) {
      moduleErrors.error(error, `Помилка відправки події верифікації для завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId, eventId }
      });
    }
  }

  /**
   * Отримання цільового значення завдання
   * @param {string} taskId - ID завдання
   * @returns {number} Цільове значення
   */
  getTaskTargetValue(taskId) {
    try {
      // Перевіряємо кеш
      const cachedValue = cacheService.get(`task_target_value_${taskId}`);
      if (cachedValue !== null) {
        return cachedValue;
      }

      // Отримуємо дані завдання зі сховища
      const task = taskStore.findTaskById(taskId);
      if (task) {
        // Кешуємо значення
        cacheService.set(`task_target_value_${taskId}`, task.target_value, {
          tags: [CACHE_TAGS.TASK, 'target_value']
        });
        return task.target_value;
      }

      // Перевіряємо прогрес
      const progress = taskStore.getTaskProgress(taskId);
      if (progress && progress.max_progress) {
        const value = parseInt(progress.max_progress) || 1;
        // Кешуємо значення
        cacheService.set(`task_target_value_${taskId}`, value, {
          tags: [CACHE_TAGS.TASK, 'target_value']
        });
        return value;
      }

      // Знаходимо елемент завдання
      const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
      if (taskElement) {
        // Пробуємо отримати цільове значення з атрибуту
        const targetAttr = taskElement.getAttribute('data-target-value');
        if (targetAttr) {
          const value = parseInt(targetAttr) || 1;
          // Кешуємо значення
          cacheService.set(`task_target_value_${taskId}`, value, {
            tags: [CACHE_TAGS.TASK, 'target_value']
          });
          return value;
        }
      }

      moduleErrors.info(`Не вдалося отримати цільове значення для завдання ${taskId}, використовуємо 1`, 'getTaskTargetValue', {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId }
      });

      // Кешуємо значення за замовчуванням
      cacheService.set(`task_target_value_${taskId}`, 1, {
        tags: [CACHE_TAGS.TASK, 'target_value']
      });

      return 1; // За замовчуванням
    } catch (error) {
      moduleErrors.error(error, `Помилка отримання цільового значення для завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId }
      });
      return 1; // За замовчуванням у випадку помилки
    }
  }

  /**
   * Очищення кешу верифікації
   */
  clearCache() {
    try {
      // Видаляємо всі кешовані дані верифікації
      cacheService.removeByTags(CACHE_TAGS.VERIFICATION);
      moduleErrors.info('Кеш верифікації очищено', 'clearCache');
    } catch (error) {
      moduleErrors.error(error, 'Помилка очищення кешу верифікації', {
        category: ERROR_CATEGORIES.LOGIC
      });
    }
  }

  /**
   * Скидання лічильників спроб
   */
  resetVerificationAttempts() {
    try {
      this.state.verificationAttempts = {};
      moduleErrors.info('Лічильники спроб верифікації скинуто', 'resetVerificationAttempts');
    } catch (error) {
      moduleErrors.error(error, 'Помилка скидання лічильників спроб верифікації', {
        category: ERROR_CATEGORIES.LOGIC
      });
    }
  }

  /**
   * Очищення оброблених подій
   */
  clearProcessedEvents() {
    try {
      // Очищаємо тільки старі події (старше 1 години)
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      let clearedCount = 0;

      for (const eventId in this.state.processedEvents) {
        const timestamp = this.state.processedEvents[eventId];
        if (now - timestamp > oneHour) {
          delete this.state.processedEvents[eventId];
          clearedCount++;
        }
      }

      // Також видаляємо з кешу
      cacheService.removeMany(key =>
        key.startsWith('processed_event_') &&
        cacheService.get(key)?.timestamp < (now - oneHour)
      );

      if (clearedCount > 0) {
        moduleErrors.info(`Очищено ${clearedCount} старих оброблених подій`, 'clearProcessedEvents');
      }
    } catch (error) {
      moduleErrors.error(error, 'Помилка очищення оброблених подій', {
        category: ERROR_CATEGORIES.LOGIC
      });
    }
  }

  /**
   * Скидання стану модуля
   */
  resetState() {
    try {
      // Очищаємо кеш
      this.clearCache();

      // Скидаємо лічильники спроб
      this.resetVerificationAttempts();

      // Очищаємо оброблені події
      this.clearProcessedEvents();

      // Скидаємо активні перевірки
      this.state.activeVerifications = {};

      // Скидаємо час останньої перевірки
      this.state.lastVerificationTime = {};

      moduleErrors.info('Стан модуля верифікації повністю скинуто', 'resetState');
    } catch (error) {
      moduleErrors.critical(error, 'Критична помилка скидання стану модуля верифікації', {
        category: ERROR_CATEGORIES.LOGIC
      });
    }
  }
}

// Створюємо і експортуємо єдиний екземпляр
const taskVerification = new TaskVerification();
export default taskVerification;