/**
 * Рендерери для системи завдань
 * Централізований експорт та фабрика для всіх типів рендерерів
 *
 * @version 3.0.0
 */

import socialRenderer from 'js/tasks/ui/renderers/types/social.js';
import limitedRenderer from 'js/tasks/ui/renderers/types/limited.js';
import partnerRenderer from 'js/tasks/ui/renderers/types/partner.js';

/**
 * Карта рендерерів за типами завдань
 */
const RENDERERS_MAP = {
  social: socialRenderer,
  limited: limitedRenderer,
  partner: partnerRenderer,
  default: socialRenderer, // Запасний варіант
};

/**
 * Отримання відповідного рендерера за типом завдання
 * @param {string} taskType - Тип завдання
 * @returns {Object} Рендерер для цього типу завдання
 */
function getRendererByType(taskType) {
  if (!taskType || typeof taskType !== 'string') {
    return RENDERERS_MAP.default;
  }

  const normalizedType = taskType.toLowerCase().trim();
  return RENDERERS_MAP[normalizedType] || RENDERERS_MAP.default;
}

/**
 * Рендеринг завдання відповідним рендерером
 * @param {Object} task - Модель завдання
 * @param {Object} progress - Дані про прогрес
 * @param {Object} options - Додаткові опції
 * @returns {HTMLElement} DOM елемент завдання
 */
function renderTask(task, progress, options = {}) {
  if (!task) return null;

  const renderer = getRendererByType(task.type);
  return renderer.render(task, progress, options);
}

/**
 * Оновлення відображення завдання
 * @param {string} taskId - ID завдання
 * @param {string} taskType - Тип завдання
 */
function refreshTaskDisplay(taskId, taskType) {
  if (!taskId) return;

  const renderer = getRendererByType(taskType);
  renderer.refreshTaskDisplay(taskId);
}

/**
 * Оновлення всіх завдань певного типу
 * @param {string} taskType - Тип завдання
 */
function refreshAllTasks(taskType) {
  const renderer = getRendererByType(taskType);
  if (typeof renderer.refreshAllTasks === 'function') {
    renderer.refreshAllTasks();
  }
}

/**
 * Додавання нового типу рендерера у фабрику
 * @param {string} type - Тип завдання
 * @param {Object} renderer - Рендерер для цього типу
 * @returns {boolean} Результат операції
 */
function registerRenderer(type, renderer) {
  if (!type || !renderer) return false;

  // Перевіряємо наявність необхідних методів
  if (typeof renderer.render !== 'function' || typeof renderer.refreshTaskDisplay !== 'function') {
    console.error(`Помилка реєстрації рендерера для типу "${type}": відсутні необхідні методи`);
    return false;
  }

  // Додаємо новий рендерер
  RENDERERS_MAP[type.toLowerCase().trim()] = renderer;
  console.log(`Зареєстровано новий рендерер для типу "${type}"`);

  return true;
}

// Публічне API
const renderersManager = {
  getRendererByType,
  renderTask,
  refreshTaskDisplay,
  refreshAllTasks,
  registerRenderer,

  // Прямий доступ до рендерерів
  renderers: RENDERERS_MAP,
};

// Експорт для ін'єкції в глобальний простір
if (typeof window !== 'undefined') {
  window.TaskRenderers = renderersManager;
}

export default renderersManager;
