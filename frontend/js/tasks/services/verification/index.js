/**
 * Сервіс верифікації завдань
 *
 * Експортує функціональність для перевірки виконання завдань
 */

import { VerificationCore } from './core/verification-core';
import { setupCacheManager } from './core/cache-manager';
import { setupEventDispatcher } from './core/event-dispatcher';
import { setupUIHandlers } from './ui/loaders';
import { verifiers } from './verifiers';

// Створюємо єдиний екземпляр сервісу верифікації
const verificationCore = new VerificationCore();

// Додаємо верифікатори
Object.entries(verifiers).forEach(([type, verifier]) => {
  verificationCore.registerVerifier(type, verifier);
});

// Налаштовуємо управління кешем
setupCacheManager(verificationCore);

// Налаштовуємо диспетчер подій
setupEventDispatcher(verificationCore);

// Налаштовуємо обробники UI
setupUIHandlers(verificationCore);

// Створюємо публічний API сервісу
const taskVerification = {
  // Основні методи верифікації
  verifyTask: (taskId) => verificationCore.verifyTask(taskId),
  isVerificationInProgress: (taskId) => verificationCore.isVerificationInProgress(taskId),

  // Робота з кешем
  getCachedResult: (taskId) => verificationCore.getCachedResult(taskId),
  clearCache: () => verificationCore.clearCache(),

  // Робота з UI
  showVerificationLoader: (taskId) => verificationCore.showVerificationLoader(taskId),
  hideVerificationLoader: (taskId) => verificationCore.hideVerificationLoader(taskId),

  // Управління станом
  resetVerificationAttempts: () => verificationCore.resetVerificationAttempts(),
  clearProcessedEvents: () => verificationCore.clearProcessedEvents(),
  resetState: () => verificationCore.resetState()
};

export default taskVerification;