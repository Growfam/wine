/**
 * Ядро сервісу верифікації
 *
 * Центральний компонент сервісу верифікації, який координує процес перевірки завдань
 */

import { VERIFICATION_STATUS } from '../../../config/verification-status.js';
import { getLogger } from '../../../utils/core/logger.js';
import {
  cacheTaskType,
  getCachedTaskType,
  cacheVerificationResult,
  getCachedVerificationResult,
  clearCache
} from './cache-manager.js';
import {
  handleVerificationError,
  createSuccessResult,
  createErrorResult
} from './error-handler.js';
import {
  dispatchVerificationEvent
} from './event-dispatcher.js';
import {
  getTaskType
} from './type-detector.js';
import {
  showVerificationLoader,
  hideVerificationLoader
} from './ui-controller.js';

// Створюємо логер для модуля
const logger = getLogger('VerificationCore');

/**
 * Клас ядра сервісу верифікації
 */
export class VerificationCore {
  /**
   * Створення нового екземпляра ядра верифікації
   */
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
      cacheTTL: 1800000, // Значення за замовчуванням, якщо CONFIG.CACHE_TTL не визначено

      // Тривалість затримки між перевірками (мс)
      throttleDelay: 5000, // Значення за замовчуванням, якщо CONFIG.THROTTLE_DELAY не визначено

      // Чи блокувати повторні запити на перевірку
      blockRepeatedRequests: true,

      // Максимальна кількість спроб верифікації
      maxVerificationAttempts: 10, // Значення за замовчуванням, якщо CONFIG.MAX_VERIFICATION_ATTEMPTS не визначено
    };

    // Встановлюємо значення з CONFIG якщо вони доступні
    try {
      if (typeof window !== 'undefined' && window.CONFIG) {
        if (window.CONFIG.CACHE_TTL) this.config.cacheTTL = window.CONFIG.CACHE_TTL;
        if (window.CONFIG.THROTTLE_DELAY) this.config.throttleDelay = window.CONFIG.THROTTLE_DELAY;
        if (window.CONFIG.MAX_VERIFICATION_ATTEMPTS) this.config.maxVerificationAttempts = window.CONFIG.MAX_VERIFICATION_ATTEMPTS;
      }
    } catch (e) {
      logger.warn('Не вдалося отримати CONFIG для верифікації: ' + e.message);
    }

    // Реєстр верифікаторів
    this.verifiers = {};

    // Сховище завдань
    this.taskStore = null;

    logger.info('Ядро верифікації створено');
  }

  /**
   * Ініціалізація сервісу верифікації
   * @param {Object} taskStore - Сховище завдань
   */
  initialize(taskStore) {
    this.taskStore = taskStore;
    logger.info('Ядро верифікації ініціалізовано');
  }

  /**
   * Реєстрація верифікатора для певного типу завдань
   * @param {string} type - Тип завдання
   * @param {Object} verifier - Верифікатор
   */
  registerVerifier(type, verifier) {
    this.verifiers[type] = verifier;
    logger.debug(`Зареєстровано верифікатор для типу завдань: ${type}`);
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
      showVerificationLoader(taskId);

      // Перевіряємо, чи не перевіряється вже це завдання
      if (this.config.blockRepeatedRequests && this.isVerificationInProgress(taskId)) {
        hideVerificationLoader(taskId);
        logger.info(`Завдання ${taskId} вже перевіряється`);

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

        hideVerificationLoader(taskId);
        logger.info(`Занадто часті запити на перевірку для завдання ${taskId}`);

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
          hideVerificationLoader(taskId);

          logger.warn(`Перевищено максимальну кількість спроб для завдання ${taskId}`);

          return {
            success: false,
            status: VERIFICATION_STATUS.FAILURE,
            message: `Перевищено максимальну кількість спроб (${this.config.maxVerificationAttempts}). Спробуйте пізніше.`,
          };
        }
      }

      // Перевіряємо наявність кешованого результату
      const cachedResult = getCachedVerificationResult(taskId);
      if (cachedResult) {
        // Використовуємо кешований успішний результат
        if (cachedResult.success) {
          hideVerificationLoader(taskId);
          logger.info(`Використано кешований результат для завдання ${taskId}`);

          // Відправляємо подію про результат перевірки
          dispatchVerificationEvent(taskId, cachedResult, `${verificationId}_cached`, this.taskStore);

          return cachedResult;
        }
      }

      // Позначаємо завдання як таке, що перевіряється
      this.state.activeVerifications[taskId] = true;
      this.state.lastVerificationTime[taskId] = Date.now();

      // Отримуємо тип завдання
      const task = this.taskStore ? this.taskStore.findTaskById(taskId) : null;
      const taskType = task ? task.type : getTaskType(taskId, this.taskStore);

      // Виконуємо специфічну для типу перевірку
      let result;

      try {
        // Вибираємо відповідний верифікатор
        const verifier = this.verifiers[taskType] || this.verifiers.generic;

        if (!verifier) {
          throw new Error(`Не знайдено верифікатор для типу завдання: ${taskType}`);
        }

        // Викликаємо метод верифікації
        result = await verifier.verify(taskId, task);
      } catch (error) {
        // Обробка помилок верифікації
        result = handleVerificationError(error, taskId);
      }

      // Приховуємо індикатор завантаження
      hideVerificationLoader(taskId);

      // Оновлюємо кеш
      cacheVerificationResult(taskId, result);

      // Видаляємо завдання з активних перевірок
      delete this.state.activeVerifications[taskId];

      // Генеруємо подію про результат перевірки
      dispatchVerificationEvent(taskId, result, verificationId, this.taskStore);

      return result;
    } catch (unexpectedError) {
      logger.error(`Критична помилка при верифікації завдання ${taskId}:`, unexpectedError);

      // Приховуємо індикатор завантаження
      hideVerificationLoader(taskId);

      // Видаляємо завдання з активних перевірок
      delete this.state.activeVerifications[taskId];

      // Формуємо результат помилки
      const errorResult = createErrorResult(
        taskId,
        'Сталася неочікувана помилка під час перевірки завдання. Спробуйте пізніше.',
        'unknown',
        unexpectedError
      );

      // Створюємо унікальний ідентифікатор події
      const errorEventId = `verification_error_${taskId}_${Date.now()}`;

      // Генеруємо подію про помилку
      dispatchVerificationEvent(taskId, errorResult, errorEventId, this.taskStore);

      return errorResult;
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
    logger.info('Лічильники спроб верифікації скинуто');
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
        logger.info(`Очищено ${clearedCount} старих оброблених подій`);
      }
    } catch (error) {
      logger.error('Помилка очищення оброблених подій:', error);
    }
  }

  /**
   * Скидання стану модуля
   */
  resetState() {
    try {
      // Очищаємо кеш
      clearCache();

      // Скидаємо лічильники спроб
      this.resetVerificationAttempts();

      // Очищаємо оброблені події
      this.clearProcessedEvents();

      // Скидаємо активні перевірки
      this.state.activeVerifications = {};

      // Скидаємо час останньої перевірки
      this.state.lastVerificationTime = {};

      logger.info('Стан модуля верифікації повністю скинуто');
    } catch (error) {
      logger.error('Критична помилка скидання стану модуля верифікації:', error);
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
      if (this.taskStore) {
        const task = this.taskStore.findTaskById(taskId);
        if (task) {
          return task.target_value;
        }

        // Перевіряємо прогрес
        const progress = this.taskStore.getTaskProgress(taskId);
        if (progress && progress.max_progress) {
          return parseInt(progress.max_progress) || 1;
        }
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
      logger.error(`Помилка отримання цільового значення для завдання ${taskId}:`, error);
      return 1; // За замовчуванням у випадку помилки
    }
  }
}