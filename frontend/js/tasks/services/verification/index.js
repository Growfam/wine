/**
 * Сервіс верифікації завдань
 *
 * Експортує функціональність для перевірки виконання завдань
 */

import { VerificationCore } from 'js/tasks/services/verification/core/verification-core.js';
import { setupCacheManager } from 'js/tasks/services/verification/core/cache-manager.js';
import { setupErrorHandler } from 'js/tasks/services/verification/core/error-handler.js';
import { setupEventDispatcher } from 'js/tasks/services/verification/core/event-dispatcher.js';
import { setupTypeDetector } from 'js/tasks/services/verification/core/type-detector.js';
import { setupUIController } from 'js/tasks/services/verification/core/ui-controller.js';
import { getLogger } from 'js/tasks/utils/core/logger.js';

// Створюємо логер для модуля
const logger = getLogger('VerificationService');

// Ініціалізуємо сервіс верифікації
function initVerificationService(taskStore, verifiers = {}) {
  logger.info('Ініціалізація сервісу верифікації');

  // Створюємо єдиний екземпляр сервісу верифікації
  const verificationCore = new VerificationCore();

  // Ініціалізуємо ядро з посиланням на сховище завдань
  verificationCore.initialize(taskStore);

  // Додаємо верифікатори
  Object.entries(verifiers).forEach(([type, verifier]) => {
    verificationCore.registerVerifier(type, verifier);
  });

  // Налаштовуємо управління кешем
  const cacheManager = setupCacheManager(verificationCore);

  // Налаштовуємо обробник помилок
  const errorHandler = setupErrorHandler();

  // Налаштовуємо визначник типів
  const typeDetector = setupTypeDetector();

  // Налаштовуємо диспетчер подій
  const eventDispatcher = setupEventDispatcher(verificationCore);

  // Налаштовуємо обробники UI
  const uiController = setupUIController(verificationCore);

  // Створюємо публічний API сервісу
  const taskVerification = {
    // Основні методи верифікації
    verifyTask: (taskId) => verificationCore.verifyTask(taskId),
    isVerificationInProgress: (taskId) => verificationCore.isVerificationInProgress(taskId),

    // Робота з кешем
    getCachedResult: (taskId) => getCachedVerificationResult(taskId),
    clearCache: () => clearCache(),

    // Робота з UI
    showVerificationLoader: (taskId) => showVerificationLoader(taskId),
    hideVerificationLoader: (taskId) => hideVerificationLoader(taskId),

    // Управління станом
    resetVerificationAttempts: () => verificationCore.resetVerificationAttempts(),
    clearProcessedEvents: () => verificationCore.clearProcessedEvents(),
    resetState: () => verificationCore.resetState(),

    // Додаткові методи для розширюваності
    registerVerifier: (type, verifier) => verificationCore.registerVerifier(type, verifier),
    getTaskType: (taskId) => typeDetector.getTaskType(taskId, taskStore),

    // Метод очищення ресурсів при закритті
    destroy: () => {
      cacheManager.clearInterval();
      eventDispatcher.clearInterval();
      logger.info('Сервіс верифікації завершив роботу');
    }
  };

  logger.info('Сервіс верифікації успішно ініціалізовано');

  return taskVerification;
}

// Створюємо сервіс верифікації з верифікаторами за замовчуванням
let defaultVerificationService = null;

// Функція для отримання або створення сервісу верифікації
export function getVerificationService(taskStore, verifiers) {
  if (!defaultVerificationService) {
    defaultVerificationService = initVerificationService(taskStore, verifiers);
  }
  return defaultVerificationService;
}

// Експортуємо функцію для безпосереднього створення сервісу
export { initVerificationService };

// Експортуємо сервіс верифікації за замовчуванням
export default getVerificationService;