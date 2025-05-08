/**
 * Ядро сервісу верифікації
 *
 * Центральний компонент сервісу верифікації, який координує процес перевірки завдань
 */

import { VERIFICATION_STATUS, CONFIG } from '../../../config';
import { taskStore } from '../../index.js';

export class VerificationCore {
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
      processedEvents: {},
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
      maxVerificationAttempts: CONFIG.MAX_VERIFICATION_ATTEMPTS,
    };

    // Реєстр верифікаторів
    this.verifiers = {};
  }

  /**
   * Реєстрація верифікатора для певного типу завдань
   * @param {string} type - Тип завдання
   * @param {Object} verifier - Верифікатор
   */
  registerVerifier(type, verifier) {
    this.verifiers[type] = verifier;
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
        console.info(`Завдання ${taskId} вже перевіряється`);

        return {
          success: false,
          status: VERIFICATION_STATUS.PENDING,
          message: 'Перевірка вже виконується. Зачекайте.',
        };
      }

      // Проміжок часу з останньої перевірки
      const lastVerificationInterval = Date.now() - (this.state.lastVerificationTime[taskId] || 0);

      // Перевіряємо чи не занадто часто перевіряється
      if (lastVerificationInterval < this.config.throttleDelay) {
        const waitTime = Math.ceil((this.config.throttleDelay - lastVerificationInterval) / 1000);

        this.hideVerificationLoader(taskId);
        console.info(`Занадто часті запити на перевірку для завдання ${taskId}`);

        return {
          success: false,
          status: VERIFICATION_STATUS.FAILURE,
          message: `Зачекайте ${waitTime} сек. перед новою спробою перевірки.`,
        };
      }

      // Перевіряємо кількість спроб
      if (this.config.maxVerificationAttempts > 0) {
        this.state.verificationAttempts[taskId] =
          (this.state.verificationAttempts[taskId] || 0) + 1;

        if (this.state.verificationAttempts[taskId] > this.config.maxVerificationAttempts) {
          this.hideVerificationLoader(taskId);

          console.warn(`Перевищено максимальну кількість спроб для завдання ${taskId}`);

          return {
            success: false,
            status: VERIFICATION_STATUS.FAILURE,
            message: `Перевищено максимальну кількість спроб (${this.config.maxVerificationAttempts}). Спробуйте пізніше.`,
          };
        }
      }

      // Перевіряємо наявність кешованого результату
      const cachedResult = this.getCachedResult(taskId);
      if (cachedResult) {
        // Використовуємо кешований успішний результат
        if (cachedResult.success) {
          this.hideVerificationLoader(taskId);
          console.info(`Використано кешований результат для завдання ${taskId}`);

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
        // Вибираємо відповідний верифікатор
        const verifier = this.verifiers[taskType] || this.verifiers.generic;

        // Викликаємо метод верифікації
        result = await verifier.verify(taskId, task);
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
      console.error(`Критична помилка при верифікації завдання ${taskId}:`, unexpectedError);

      // Приховуємо індикатор завантаження
      this.hideVerificationLoader(taskId);

      // Видаляємо завдання з активних перевірок
      delete this.state.activeVerifications[taskId];

      // Формуємо результат помилки
      const errorResult = {
        success: false,
        status: VERIFICATION_STATUS.ERROR,
        message: 'Сталася неочікувана помилка під час перевірки завдання. Спробуйте пізніше.',
        error: unexpectedError.message,
      };

      // Створюємо унікальний ідентифікатор події
      const errorEventId = `verification_error_${taskId}_${Date.now()}`;

      // Генеруємо подію про помилку
      this.dispatchVerificationEvent(taskId, errorResult, errorEventId);

      return errorResult;
    }
  }

  /**
   * Обробка помилки верифікації
   * @param {Error} error - Об'єкт помилки
   * @param {string} taskId - ID завдання
   * @returns {Object} Оброблений результат помилки
   */
  handleVerificationError(error, taskId) {
    console.error(`Помилка при верифікації завдання ${taskId}:`, error);

    // Класифікуємо помилку
    let status = VERIFICATION_STATUS.ERROR;
    let message = 'Сталася помилка під час перевірки завдання. Спробуйте пізніше.';

    // Перевіряємо тип помилки
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      status = VERIFICATION_STATUS.TIMEOUT;
      message =
        "Перевищено час очікування відповіді від сервера. Перевірте з'єднання та спробуйте ще раз.";
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      status = VERIFICATION_STATUS.NETWORK_ERROR;
      message =
        "Проблема з мережевим з'єднанням. Перевірте підключення до Інтернету та спробуйте ще раз.";
    } else if (error.status === 401 || error.status === 403) {
      message = 'Помилка авторизації. Оновіть сторінку та спробуйте знову.';
    } else if (error.status === 429) {
      message = 'Занадто багато запитів. Будь ласка, спробуйте пізніше.';
    } else if (error.message && error.message.includes('CORS')) {
      status = VERIFICATION_STATUS.NETWORK_ERROR;
      message =
        'Проблема з доступом до сервера. Спробуйте оновити сторінку або використати інший браузер.';
    }

    return {
      success: false,
      status: status,
      message: message,
      error: error.message,
      taskId: taskId,
    };
  }

  /**
   * Отримання типу завдання
   * @param {string} taskId - ID завдання
   * @returns {string} Тип завдання
   */
  getTaskType(taskId) {
    try {
      // Перевіряємо кеш спочатку
      const cachedType = this.getCachedTaskType(taskId);
      if (cachedType) {
        return cachedType;
      }

      // Спочатку використовуємо сховище завдань
      const task = taskStore.findTaskById(taskId);
      if (task) {
        // Кешуємо тип
        this.cacheTaskType(taskId, task.type);
        return task.type;
      }

      // Визначаємо тип за ID
      let determinedType;
      if (taskId.startsWith('social_')) {
        determinedType = 'social';
      } else if (taskId.startsWith('limited_')) {
        determinedType = 'limited';
      } else if (taskId.startsWith('partner_')) {
        determinedType = 'partner';
      } else if (taskId.startsWith('referral_')) {
        determinedType = 'referral';
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
              determinedType = 'social';
            } else if (limitedContainer && limitedContainer.contains(taskElement)) {
              determinedType = 'limited';
            } else if (partnersContainer && partnersContainer.contains(taskElement)) {
              determinedType = 'partner';
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
        this.cacheTaskType(taskId, determinedType);
      }

      if (determinedType === 'unknown') {
        console.warn(`Не вдалося визначити тип завдання ${taskId}`);
      }

      return determinedType;
    } catch (error) {
      console.error(`Помилка при визначенні типу завдання ${taskId}:`, error);
      return 'unknown';
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
   * Скидання лічильників спроб
   */
  resetVerificationAttempts() {
    this.state.verificationAttempts = {};
    console.info('Лічильники спроб верифікації скинуто');
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

      if (clearedCount > 0) {
        console.info(`Очищено ${clearedCount} старих оброблених подій`);
      }
    } catch (error) {
      console.error('Помилка очищення оброблених подій:', error);
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

      console.info('Стан модуля верифікації повністю скинуто');
    } catch (error) {
      console.error('Критична помилка скидання стану модуля верифікації:', error);
    }
  }

  /**
   * Отримання цільового значення завдання
   * @param {string} taskId - ID завдання
   * @returns {number} Цільове значення
   */
  getTaskTargetValue(taskId) {
    try {
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
    } catch (error) {
      console.error(`Помилка отримання цільового значення для завдання ${taskId}:`, error);
      return 1; // За замовчуванням у випадку помилки
    }
  }

  /**
   * Кешування типу завдання
   * @param {string} taskId - ID завдання
   * @param {string} type - Тип завдання
   */
  cacheTaskType(taskId, type) {
    try {
      const cacheKey = `task_type_${taskId}`;
      // Використовуємо localStorage для базової реалізації кешування
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(cacheKey, type);
      }

      // Якщо є глобальний сервіс кешування, використовуємо його
      const cacheService = window.cacheService;
      if (cacheService && typeof cacheService.set === 'function') {
        cacheService.set(cacheKey, type, {
          tags: ['task_type', taskId],
        });
      }

      console.debug(`Тип завдання ${taskId} кешовано як ${type}`);
    } catch (error) {
      console.warn(`Помилка при кешуванні типу завдання ${taskId}:`, error);
    }
  }

  /**
   * Отримання кешованого типу завдання
   * @param {string} taskId - ID завдання
   * @returns {string|null} Тип завдання
   */
  getCachedTaskType(taskId) {
    try {
      const cacheKey = `task_type_${taskId}`;

      // Спочатку перевіряємо глобальний сервіс кешування
      const cacheService = window.cacheService;
      if (cacheService && typeof cacheService.get === 'function') {
        const cachedType = cacheService.get(cacheKey);
        if (cachedType) {
          return cachedType;
        }
      }

      // Потім перевіряємо localStorage
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(cacheKey);
      }

      return null;
    } catch (error) {
      console.warn(`Помилка при отриманні кешованого типу завдання ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Кешування результату верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} result - Результат перевірки
   */
  cacheResult(taskId, result) {
    try {
      const cacheKey = `verification_result_${taskId}`;
      const cacheData = {
        result,
        timestamp: Date.now(),
        expires: Date.now() + (result.success ? this.config.cacheTTL * 2 : this.config.cacheTTL),
      };

      // Використовуємо localStorage для базової реалізації кешування
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      }

      // Якщо є глобальний сервіс кешування, використовуємо його
      const cacheService = window.cacheService;
      if (cacheService && typeof cacheService.set === 'function') {
        const ttl = result.success ? this.config.cacheTTL * 2 : this.config.cacheTTL;
        cacheService.set(cacheKey, cacheData, {
          ttl,
          tags: ['verification', 'result', taskId],
        });
      }

      console.debug(`Результат верифікації для завдання ${taskId} кешовано`);
    } catch (error) {
      console.warn(`Помилка при кешуванні результату верифікації для завдання ${taskId}:`, error);
    }
  }

  /**
   * Отримання кешованого результату верифікації
   * @param {string} taskId - ID завдання
   * @returns {Object|null} Результат перевірки
   */
  getCachedResult(taskId) {
    try {
      const cacheKey = `verification_result_${taskId}`;
      let cachedData = null;

      // Спочатку перевіряємо глобальний сервіс кешування
      const cacheService = window.cacheService;
      if (cacheService && typeof cacheService.get === 'function') {
        cachedData = cacheService.get(cacheKey);
      }

      // Потім перевіряємо localStorage, якщо не знайдено в cacheService
      if (!cachedData && typeof localStorage !== 'undefined') {
        const storedData = localStorage.getItem(cacheKey);
        if (storedData) {
          try {
            cachedData = JSON.parse(storedData);
          } catch (parseError) {
            console.warn(`Помилка парсингу кешованого результату для завдання ${taskId}:`, parseError);
          }
        }
      }

      // Перевіряємо термін дії кешу
      if (cachedData && cachedData.expires) {
        if (Date.now() > cachedData.expires) {
          console.debug(`Кеш для завдання ${taskId} застарів`);
          return null;
        }

        return cachedData.result;
      }

      return null;
    } catch (error) {
      console.warn(`Помилка при отриманні кешованого результату для завдання ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Очищення кешу верифікації
   */
  clearCache() {
    try {
      // Очищаємо кеш через глобальний сервіс, якщо доступно
      const cacheService = window.cacheService;
      if (cacheService) {
        if (typeof cacheService.removeByTags === 'function') {
          cacheService.removeByTags(['verification']);
        } else if (typeof cacheService.clear === 'function') {
          cacheService.clear();
        }
      }

      // Очищаємо локальне сховище від записів з префіксом verification_
      if (typeof localStorage !== 'undefined') {
        Object.keys(localStorage)
          .filter(key => key.startsWith('verification_') || key.startsWith('task_type_'))
          .forEach(key => localStorage.removeItem(key));
      }

      console.info('Кеш верифікації очищено');
    } catch (error) {
      console.error('Помилка при очищенні кешу верифікації:', error);
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
      // Перевіряємо, чи був ідентифікатор уже оброблений
      if (eventId && this.state.processedEvents[eventId]) {
        console.debug(`Подія ${eventId} вже була оброблена`);
        return;
      }

      // Запам'ятовуємо ідентифікатор як оброблений
      if (eventId) {
        this.state.processedEvents[eventId] = Date.now();
      }

      // Додаємо часову мітку до результату
      const extendedResult = {
        ...result,
        timestamp: Date.now(),
      };

      // Створюємо і відправляємо подію
      if (typeof document !== 'undefined') {
        document.dispatchEvent(
          new CustomEvent('task-verification-result', {
            detail: {
              taskId,
              result: extendedResult,
              timestamp: Date.now(),
              eventId,
            },
          })
        );
      }

      // Якщо верифікація була успішною, викликаємо обробку
      if (result.success) {
        this.handleSuccessfulVerification(taskId, extendedResult, eventId);
      }

      console.debug(`Відправлено подію верифікації для завдання ${taskId}`);
    } catch (error) {
      console.error(`Помилка при відправці події верифікації для завдання ${taskId}:`, error);
    }
  }

  /**
   * Обробка успішної верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} result - Результат перевірки
   * @param {string} eventId - Унікальний ідентифікатор події
   */
  handleSuccessfulVerification(taskId, result, eventId) {
    try {
      // Отримуємо цільове значення завдання
      const targetValue = this.getTaskTargetValue(taskId);

      // Оновлюємо прогрес у сховищі, якщо воно доступне
      if (taskStore && typeof taskStore.setTaskProgress === 'function') {
        taskStore.setTaskProgress(taskId, {
          status: 'completed',
          progress_value: targetValue,
          completion_date: new Date().toISOString(),
        });
      }

      // Генеруємо подію про завершення завдання з короткою затримкою
      setTimeout(() => {
        if (typeof document !== 'undefined') {
          document.dispatchEvent(
            new CustomEvent('task-completed', {
              detail: {
                taskId,
                reward: result.reward,
                timestamp: Date.now(),
                eventId,
              },
            })
          );
        }

        console.debug(`Відправлено подію завершення для завдання ${taskId}`);
      }, 50);
    } catch (error) {
      console.error(`Помилка при обробці успішної верифікації для завдання ${taskId}:`, error);
    }
  }

  /**
   * Показати індикатор завантаження верифікації
   * @param {string} taskId - ID завдання
   */
  showVerificationLoader(taskId) {
    try {
      // Знаходимо елемент завдання
      const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
      if (!taskElement) return;

      // Знаходимо елемент дії
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
      console.warn(`Помилка при показі індикатора завантаження для завдання ${taskId}:`, error);
    }
  }

  /**
   * Приховати індикатор завантаження верифікації
   * @param {string} taskId - ID завдання
   */
  hideVerificationLoader(taskId) {
    try {
      // Знаходимо елемент завдання
      const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
      if (!taskElement) return;

      // Знаходимо елемент дії
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
      console.warn(`Помилка при приховуванні індикатора завантаження для завдання ${taskId}:`, error);
    }
  }
}