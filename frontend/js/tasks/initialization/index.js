/**
 * Індексний файл підсистеми ініціалізації
 *
 * Експортує компоненти для ініціалізації системи завдань:
 * - Завантажувач модулів
 * - Ініціалізатор системи
 * - Методи системи
 *
 * @version 3.1.0
 */

import initialize from 'js/tasks/initialization/initialization.js';
import * as moduleLoader from 'js/tasks/initialization/module-loader.js';
import * as systemMethods from 'js/tasks/initialization/system-methods.js';

// Реекспорт основних функцій для зручного використання
export const initializeSystem = initialize;
export const loadModules = moduleLoader.loadModules;
export const getModuleCache = moduleLoader.getModuleCache;

// Реекспорт методів системи
export const {
  getTasks,
  findTaskById,
  startTask,
  verifyTask,
  updateTaskProgress,
  getTaskProgress,
  syncProgress,
  claimDailyBonus,
  setActiveTab,
  updateBalance,
  getSystemState,
  resetState,
  dispatchSystemEvent
} = systemMethods;

// Експорт за замовчуванням
export default {
  initializeSystem: initialize,
  moduleLoader,
  systemMethods,

  // Зручні методи
  initialize,
  loadModules: moduleLoader.loadModules,
  getTasks,
  findTaskById,
  startTask,
  verifyTask,
  updateTaskProgress,
  getTaskProgress,
  syncProgress,
  claimDailyBonus,
  setActiveTab,
  updateBalance,
  getSystemState,
  resetState
};