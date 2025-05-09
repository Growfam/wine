/**
 * Рендерери для системи завдань
 * Централізований експорт для всіх типів рендерерів
 *
 * @version 3.0.0
 */

import socialRenderer from 'js/tasks/ui/renderers/types/social.js';
import limitedRenderer from 'js/tasks/ui/renderers/types/limited.js';
import partnerRenderer from 'js/tasks/ui/renderers/types/partner.js';
import factory from 'js/tasks/ui/renderers/factory.js';

// Реекспортуємо API фабрики
export const {
  getRendererByType,
  renderTask,
  refreshTaskDisplay,
  refreshAllTasks,
  registerRenderer,
} = factory;

// Експортуємо базовий клас для інтеграцій
export { default as BaseRenderer, TASK_STATUS } from 'js/tasks/ui/renderers/base.js';

// Експортуємо доступні рендерери
export const renderers = {
  social: socialRenderer,
  limited: limitedRenderer,
  partner: partnerRenderer,
};

// Для зворотної сумісності зі старим кодом
if (typeof window !== 'undefined') {
  window.TaskRenderers = factory;
}

// Експортуємо за замовчуванням фабрику рендерерів
export default factory;
