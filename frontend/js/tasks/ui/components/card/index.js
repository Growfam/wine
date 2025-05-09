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
} from 'js/tasks/ui/components/card/base.js';
export {
  setupActionButtons,
  handleStartTask,
  handleVerifyTask,
  updateActionStatus,
} from 'js/tasks/ui/components/card/actions.js';
export { render as renderProgress, updateProgress, getProgressElement } from 'js/tasks/ui/components/card/progress.js';

// Експортуємо типи карток
export * from 'js/tasks/ui/components/card/types/index.js';

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
