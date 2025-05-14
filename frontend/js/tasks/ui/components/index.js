/**
 * Головний індексний файл компонентів UI
 * Реорганізований для уникнення циклічних залежностей
 */

// Змінні для збереження завантажених модулів
let cardModule = null;
let progressModule = null;
let rewardModule = null;
let modulesLoaded = false;
let loadPromise = null;

/**
 * Асинхронна ініціалізація UI компонентів
 * @returns {Promise<boolean>} Результат ініціалізації
 */
export async function initComponents() {
  if (modulesLoaded) {
    return true;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise(async (resolve) => {
    try {
      // Завантажуємо всі модулі асинхронно
      const results = await Promise.allSettled([
        import('./card/index.js'),
        import('./progress/index.js'),
        import('./reward/index.js')
      ]);

      // Зберігаємо успішно завантажені модулі
      cardModule = results[0].status === 'fulfilled' ? results[0].value : {};
      progressModule = results[1].status === 'fulfilled' ? results[1].value : {};
      rewardModule = results[2].status === 'fulfilled' ? results[2].value : {};

      // Заповнюємо прямі посилання для зворотної сумісності
      Object.assign(card, cardModule);
      Object.assign(progress, progressModule);
      Object.assign(reward, rewardModule);

      modulesLoaded = true;
      resolve(true);
    } catch (error) {
      console.error('Помилка ініціалізації UI компонентів:', error);
      resolve(false);
    }
  });

  return loadPromise;
}

/**
 * Отримання компоненту карточки
 * @returns {Object} Модуль компонентів карточки
 */
export function getCardComponents() {
  return cardModule;
}

/**
 * Отримання компоненту прогресу
 * @returns {Object} Модуль компонентів прогресу
 */
export function getProgressComponents() {
  return progressModule;
}

/**
 * Отримання компоненту винагороди
 * @returns {Object} Модуль компонентів винагороди
 */
export function getRewardComponents() {
  return rewardModule;
}

// Порожні об'єкти для зворотної сумісності
export const card = {};
export const progress = {};
export const reward = {};

// Запускаємо ініціалізацію з невеликою затримкою, щоб дати час
// іншим модулям завантажитись
setTimeout(() => {
  initComponents().catch(error => {
    console.error('Помилка автоініціалізації компонентів:', error);
  });
}, 500);