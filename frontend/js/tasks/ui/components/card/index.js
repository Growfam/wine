/**
 * Модуль карток завдань - основна точка входу
 */

// Експортуємо основні компоненти
export {
  default,
  create,
  updateStatus,
  TASK_STATUS,
  escapeHtml,
  getTaskElementById,
} from './base.js';
export {
  setupActionButtons,
  handleStartTask,
  handleVerifyTask,
  updateActionStatus,
} from './actions.js';
export { render as renderProgress, updateProgress, getProgressElement } from './progress.js';

// Експортуємо типи карток
export * from './types/index.js';

// Експорт ключових об'єктів для зручності
export const Card = {
  create,
  updateStatus,
  progress: {
    render: renderProgress,
    update: updateProgress,
  },
  actions: {
    setupButtons: setupActionButtons,
    handleStart: handleStartTask,
    handleVerify: handleVerifyTask,
  },
};
