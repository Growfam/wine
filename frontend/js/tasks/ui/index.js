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
  initComponents: async () => false,
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

// Стан ініціалізації
let initialized = false;
let initPromise = null;

/**
 * Функція обробки помилок у модулях
 * @param {string} moduleName - Назва модуля
 * @param {Error} error - Об'єкт помилки
 */
function handleModuleError(moduleName, error) {
  console.warn(`Не вдалося завантажити модуль ${moduleName}:`, error.message);
}

/**
 * Асинхронна ініціалізація всіх UI модулів
 * @returns {Promise<boolean>} Результат ініціалізації
 */
export async function init() {
  if (initialized) {
    return true;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise(async (resolve) => {
    try {
      // Завантажуємо всі модулі асинхронно
      const [animationsModule, componentsModule, notificationsModule, renderersModule, dailyBonusModule] =
        await Promise.allSettled([
          import('./animations/index.js').catch(error => {
            handleModuleError('animations', error);
            return dummyAnimations;
          }),
          import('./components/index.js').catch(error => {
            handleModuleError('components', error);
            return dummyComponents;
          }),
          import('./notifications/index.js').catch(error => {
            handleModuleError('notifications', error);
            return dummyNotifications;
          }),
          import('./renderers/index.js').catch(error => {
            handleModuleError('renderers', error);
            return dummyRenderers;
          }),
          import('./components/daily-bonus/index.js').catch(error => {
            handleModuleError('DailyBonus', error);
            return { default: dummyDailyBonus };
          })
        ]);

      // Присвоюємо значення модулів, перевіряючи успішність їх завантаження
      animations = animationsModule.status === 'fulfilled' ? animationsModule.value : dummyAnimations;
      components = componentsModule.status === 'fulfilled' ? componentsModule.value : dummyComponents;
      notifications = notificationsModule.status === 'fulfilled' ? notificationsModule.value : dummyNotifications;
      renderers = renderersModule.status === 'fulfilled' ? renderersModule.value : dummyRenderers;
      DailyBonus = dailyBonusModule.status === 'fulfilled' ? dailyBonusModule.value.default : dummyDailyBonus;

      // Ініціалізуємо компоненти, якщо є метод init
      if (components.initComponents) {
        await components.initComponents();
      }

      initialized = true;
      resolve(true);
    } catch (error) {
      console.error('Помилка ініціалізації UI модулів:', error);
      resolve(false);
    }
  });

  return initPromise;
}

// Запускаємо ініціалізацію автоматично з невеликою затримкою
setTimeout(() => {
  init().catch(error => {
    console.error('Помилка автоініціалізації UI:', error);
  });
}, 100);

// Експортуємо модулі
export {
  animations,
  components,
  notifications,
  renderers,
  DailyBonus,
  init
};

// Експорт за замовчуванням
export default {
  animations,
  components,
  notifications,
  renderers,
  DailyBonus,
  init
};