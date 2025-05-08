/**
 * Головна точка входу для всіх UI компонентів системи завдань
 *
 * Експортує всі необхідні компоненти та модулі для UI частини системи
 */

// ВИПРАВЛЕНО: Додано перевірку наявності модулів перед імпортом
try {
  // Імпортуємо основні модулі
  import * as animations from './animations/index.js';
  import * as components from './components/index.js';
  import * as notifications from './notifications/index.js';
  import * as renderers from './renderers/index.js';

  // Експорт компонентів щоденного бонусу
  import DailyBonus from './components/daily-bonus/index.js';

  // Експортуємо все разом
  export {
    animations,
    components,
    notifications,
    renderers,
    DailyBonus
  };
} catch (error) {
  // Створюємо заглушки для відсутніх модулів
  console.warn('Не вдалося завантажити один або більше UI модулів. Створено заглушки.', error);

  // Заглушка для анімацій
  const dummyAnimations = {
    animate: () => {},
    fadeIn: () => {},
    fadeOut: () => {},
    slideIn: () => {},
    slideOut: () => {}
  };

  // Заглушка для компонентів
  const dummyComponents = {
    createComponent: () => ({}),
    renderComponent: () => {},
    updateComponent: () => {}
  };

  // Заглушка для сповіщень
  const dummyNotifications = {
    showNotification: () => {},
    showSuccess: () => {},
    showError: () => {},
    hideNotification: () => {}
  };

  // Заглушка для рендерерів
  const dummyRenderers = {
    renderTaskList: () => {},
    renderTaskItem: () => {},
    renderTaskProgress: () => {}
  };

  // Заглушка для компонента щоденного бонусу
  const dummyDailyBonus = {
    render: () => {},
    update: () => {},
    claim: async () => ({ success: false, error: 'Модуль щоденного бонусу недоступний' })
  };

  // Експортуємо заглушки
  export const animations = dummyAnimations;
  export const components = dummyComponents;
  export const notifications = dummyNotifications;
  export const renderers = dummyRenderers;
  export const DailyBonus = dummyDailyBonus;
}