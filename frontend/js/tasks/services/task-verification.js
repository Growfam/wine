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

class TaskVerification {
  constructor() {
    // Кеш для результатів верифікації
    this.verificationCache = new Map();

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
          return {
            success: false,
            status: VERIFICATION_STATUS.FAILURE,
            message: `Перевищено максимальну кількість спроб (${this.config.maxVerificationAttempts}). Спробуйте пізніше.`
          };
        }
      }

      // Перевіряємо наявність кешованого результату
      if (this.hasCachedResult(taskId)) {
        const cachedResult = this.getCachedResult(taskId);

        // Використовуємо кешований успішний результат
        if (cachedResult.success) {
          this.hideVerificationLoader(taskId);

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
      console.error('Критична помилка при верифікації завдання:', unexpectedError);

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
    // Отримуємо дані завдання
    const task = taskStore.findTaskById(taskId);

    if (!task) {
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
    return await this.verifyGenericTask(taskId);
  }

  /**
   * Перевірка лімітованого завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат перевірки
   */
  async verifyLimitedTask(taskId) {
    // Отримуємо дані завдання
    const task = taskStore.findTaskById(taskId);

    if (!task) {
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
  }

  /**
   * Перевірка партнерського завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат перевірки
   */
  async verifyPartnerTask(taskId) {
    // Отримуємо дані завдання
    const task = taskStore.findTaskById(taskId);

    if (!task) {
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
  }

  /**
   * Перевірка загального завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат перевірки
   */
  async verifyGenericTask(taskId) {
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
        return {
          success: true,
          status: VERIFICATION_STATUS.SUCCESS,
          message: response.message || 'Завдання успішно виконано!',
          reward: response.data?.reward || null,
          verification_details: response.data?.verification || {},
          response_time_ms: Date.now() - this.state.lastVerificationTime[taskId]
        };
      } else {
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
    console.error('Помилка при верифікації завдання:', error);

    // Класифікуємо помилку
    let status = VERIFICATION_STATUS.ERROR;
    let message = 'Сталася помилка під час перевірки завдання. Спробуйте пізніше.';

    // Перевіряємо тип помилки
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      status = VERIFICATION_STATUS.TIMEOUT;
      message = 'Перевищено час очікування відповіді від сервера. Перевірте з\'єднання та спробуйте ще раз.';
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      status = VERIFICATION_STATUS.NETWORK_ERROR;
      message = 'Проблема з мережевим з\'єднанням. Перевірте підключення до Інтернету та спробуйте ще раз.';
    } else if (error.status === 401 || error.status === 403) {
      message = 'Помилка авторизації. Оновіть сторінку та спробуйте знову.';
    } else if (error.status === 429) {
      message = 'Занадто багато запитів. Будь ласка, спробуйте пізніше.';
    } else if (error.message && error.message.includes('CORS')) {
      status = VERIFICATION_STATUS.NETWORK_ERROR;
      message = 'Проблема з доступом до сервера. Спробуйте оновити сторінку або використати інший браузер.';
    }

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
  }

  /**
   * Отримання типу завдання
   * @param {string} taskId - ID завдання
   * @returns {string} Тип завдання
   */
  getTaskType(taskId) {
    // Спочатку використовуємо сховище завдань
    const task = taskStore.findTaskById(taskId);
    if (task) {
      return task.type;
    }

    // Визначаємо тип за ID
    if (taskId.startsWith('social_')) {
      return TASK_TYPES.SOCIAL;
    } else if (taskId.startsWith('limited_')) {
      return TASK_TYPES.LIMITED;
    } else if (taskId.startsWith('partner_')) {
      return TASK_TYPES.PARTNER;
    } else if (taskId.startsWith('referral_')) {
      return TASK_TYPES.REFERRAL;
    }

    // Спробуємо визначити тип за DOM
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (taskElement) {
      const taskType = taskElement.dataset.taskType;
      if (taskType) {
        return taskType;
      }

      // Визначаємо тип за контейнером
      const socialContainer = document.getElementById('social-tasks-container');
      const limitedContainer = document.getElementById('limited-tasks-container');
      const partnersContainer = document.getElementById('partners-tasks-container');

      if (socialContainer && socialContainer.contains(taskElement)) {
        return TASK_TYPES.SOCIAL;
      } else if (limitedContainer && limitedContainer.contains(taskElement)) {
        return TASK_TYPES.LIMITED;
      } else if (partnersContainer && partnersContainer.contains(taskElement)) {
        return TASK_TYPES.PARTNER;
      }
    }

    return 'unknown';
  }

  /**
   * Показати індикатор завантаження верифікації
   * @param {string} taskId - ID завдання
   */
  showVerificationLoader(taskId) {
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
  }

  /**
   * Приховати індикатор завантаження верифікації
   * @param {string} taskId - ID завдання
   */
  hideVerificationLoader(taskId) {
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
   * @returns {boolean} Чи є кешований результат
   */
  hasCachedResult(taskId) {
    if (!this.verificationCache.has(taskId)) return false;

    // Перевіряємо час життя кешу
    const cache = this.verificationCache.get(taskId);
    return cache && (Date.now() - cache.timestamp) < this.config.cacheTTL;
  }

  /**
   * Отримання кешованого результату
   * @param {string} taskId - ID завдання
   * @returns {Object|null} Кешований результат
   */
  getCachedResult(taskId) {
    if (!this.hasCachedResult(taskId)) return null;
    return this.verificationCache.get(taskId).result;
  }

  /**
   * Кешування результату
   * @param {string} taskId - ID завдання
   * @param {Object} result - Результат перевірки
   */
  cacheResult(taskId, result) {
    this.verificationCache.set(taskId, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Відправлення події про результат верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} result - Результат перевірки
   * @param {string} eventId - Унікальний ідентифікатор події
   */
  dispatchVerificationEvent(taskId, result, eventId) {
    // Перевіряємо, чи не був цей eventId вже оброблений
    if (eventId && this.state.processedEvents[eventId]) {
      return;
    }

    // Зберігаємо ідентифікатор події як оброблений
    if (eventId) {
      this.state.processedEvents[eventId] = Date.now();
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
      taskStore.setTaskProgress(taskId, {
        status: 'completed',
        progress_value: targetValue,
        completion_date: new Date().toISOString()
      });

      // Затримка перед відправкою події завершення завдання
      setTimeout(() => {
        // Відправляємо подію про завершення завдання
        document.dispatchEvent(new CustomEvent('task-completed', {
          detail: {
            taskId,
            reward: result.reward,
            timestamp: Date.now(),
            eventId
          }
        }));
      }, 50);
    }
  }

  /**
   * Отримання цільового значення завдання
   * @param {string} taskId - ID завдання
   * @returns {number} Цільове значення
   */
  getTaskTargetValue(taskId) {
    // Отримуємо дані завдання зі сховища
    const task = taskStore.findTaskById(taskId);
    if (task) {
      return task.target_value;
    }

    // Перевіряємо прогрес
    const progress = taskStore.getTaskProgress(taskId);
    if (progress && progress.max_progress) {
      return parseInt(progress.max_progress) || 1;
    }

    // Знаходимо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (taskElement) {
      // Пробуємо отримати цільове значення з атрибуту
      const targetAttr = taskElement.getAttribute('data-target-value');
      if (targetAttr) {
        return parseInt(targetAttr) || 1;
      }
    }

    return 1; // За замовчуванням
  }

  /**
   * Очищення кешу верифікації
   */
  clearCache() {
    this.verificationCache.clear();
  }

  /**
   * Скидання лічильників спроб
   */
  resetVerificationAttempts() {
    this.state.verificationAttempts = {};
  }

  /**
   * Очищення оброблених подій
   */
  clearProcessedEvents() {
    // Очищаємо тільки старі події (старше 1 години)
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const eventId in this.state.processedEvents) {
      const timestamp = this.state.processedEvents[eventId];
      if (now - timestamp > oneHour) {
        delete this.state.processedEvents[eventId];
      }
    }
  }

  /**
   * Скидання стану модуля
   */
  resetState() {
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
  }
}

// Створюємо і експортуємо єдиний екземпляр сервісу верифікації
const taskVerification = new TaskVerification();
export default taskVerification;