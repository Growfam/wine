/**
 * Головна точка входу для всіх UI компонентів системи завдань
 *
 * Експортує всі необхідні компоненти та модулі для UI частини системи
 */

// Визначаємо заглушки, які будуть використані, якщо модулі не завантажаться
const dummyAnimations = {
  animate: () => {},
  fadeIn: () => {},
  fadeOut: () => {},
  slideIn: () => {},
  slideOut: () => {},
  init: () => {},
};

const dummyComponents = {
  createComponent: () => ({}),
  renderComponent: () => {},
  updateComponent: () => {},
};

const dummyNotifications = {
  showNotification: () => {},
  showSuccess: () => {},
  showError: () => {},
  hideNotification: () => {},
};

const dummyRenderers = {
  renderTaskList: () => {},
  renderTaskItem: () => {},
  renderTaskProgress: () => {},
};

const dummyDailyBonus = {
  render: () => {},
  update: () => {},
  claim: async () => ({ success: false, error: 'Модуль щоденного бонусу недоступний' }),
};

// Заготовки для експорту
let animations = dummyAnimations;
let components = dummyComponents;
let notifications = dummyNotifications;
let renderers = dummyRenderers;
let DailyBonus = dummyDailyBonus;

// Функція обробки помилок у модулях
function handleModuleError(moduleName, error) {
  console.warn(`Не вдалося завантажити модуль ${moduleName}:`, error.message);
}

// Завантаження модуля анімацій
try {
  animations = require('js/tasks/ui/animations/index.js');
} catch (error) {
  handleModuleError('animations', error);
}

// Завантаження модуля компонентів
try {
  components = require('js/tasks/ui/components/index.js');
} catch (error) {
  handleModuleError('components', error);
}

// Завантаження модуля сповіщень
try {
  notifications = require('js/tasks/ui/notifications/index.js');
} catch (error) {
  handleModuleError('notifications', error);
}

// Завантаження модуля рендерерів
try {
  renderers = require('js/tasks/ui/renderers/index.js');
} catch (error) {
  handleModuleError('renderers', error);
}

// Завантаження модуля щоденного бонусу
try {
  DailyBonus = require('js/tasks/ui/components/daily-bonus/index.js').default;
} catch (error) {
  handleModuleError('DailyBonus', error);
}

// Експортуємо модулі
export {
  animations,
  components,
  notifications,
  renderers,
  DailyBonus
};

// Експорт за замовчуванням
export default {
  animations,
  components,
  notifications,
  renderers,
  DailyBonus
};