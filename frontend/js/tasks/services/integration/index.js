/**
 * Сервіс інтеграції системи завдань
 *
 * Експортує функціональність для координації та інтеграції модулів системи завдань
 */

import { Initializer } from './initializer.js';
import { DependencyManager } from './dependency-manager.js';
import { ConflictResolver } from './conflict-resolver.js';
import { UserProvider } from './user-provider.js';
import { DiagnosticsService } from './diagnostics.js';

// Створюємо екземпляр сервісу інтеграції
const initializer = new Initializer();
const dependencyManager = new DependencyManager();
const conflictResolver = new ConflictResolver();
const userProvider = new UserProvider();
const diagnosticsService = new DiagnosticsService();

// Об'єднуємо всі компоненти в єдиний інтеграційний сервіс
const taskIntegration = {
  // Стан інтеграції
  state: initializer.state,

  // Конфігурація
  config: initializer.config,

  // Методи ініціалізації
  init: (options) => initializer.init(options),
  autoRegisterGlobalModules: () => initializer.autoRegisterGlobalModules(),

  // Методи управління залежностями
  register: (moduleName, moduleInstance) => dependencyManager.register(moduleName, moduleInstance),
  getModule: (moduleName) => dependencyManager.getModule(moduleName),
  initModulesInOrder: () => initializer.initModulesInOrder(),
  initializeModule: (moduleName) => initializer.initializeModule(moduleName),
  injectDependencies: (moduleObj, moduleName) =>
    dependencyManager.injectDependencies(moduleObj, moduleName),

  // Методи вирішення конфліктів
  resolveModuleConflicts: () => conflictResolver.resolveModuleConflicts(),

  // Методи отримання ID користувача
  safeGetUserId: () => userProvider.safeGetUserId(),
  fixUserIdIssues: () => userProvider.fixUserIdIssues(),

  // Методи діагностики
  diagnose: () => diagnosticsService.diagnose(),
  recoverFailedModules: () => diagnosticsService.recoverFailedModules(),
  finalizeInitialization: () => initializer.finalizeInitialization(),

  // Методи скидання стану
  reset: () => initializer.reset(),
};

// Для зворотної сумісності зі старою системою, додаємо в глобальний простір
window.TaskIntegration = taskIntegration;

// Ініціалізуємо модуль при завантаженні скрипту
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => taskIntegration.init());
} else {
  // Невелика затримка для завершення завантаження інших скриптів
  setTimeout(() => taskIntegration.init(), 100);
}

export default taskIntegration;
