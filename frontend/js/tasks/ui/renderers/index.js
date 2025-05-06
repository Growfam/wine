/**
 * Рендерери для системи завдань
 * Централізований експорт для всіх типів рендерерів
 *
 * @version 3.0.0
 */

import socialRenderer from '/social.js';
import limitedRenderer from './limited.js';
import partnerRenderer from './partner.js';

/**
 * Карта рендерерів за типами завдань
 */
const RENDERERS_MAP = {
    'social': socialRenderer,
    'limited': limitedRenderer,
    'partner': partnerRenderer,
    'default': socialRenderer  // Запасний варіант
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

// Публічне API
const renderersManager = {
    getRendererByType,
    renderTask,
    refreshTaskDisplay,
    refreshAllTasks,

    // Прямий доступ до рендерерів
    renderers: RENDERERS_MAP
};

// Експорт для ін'єкції в глобальний простір
if (typeof window !== 'undefined') {
    window.TaskRenderers = renderersManager;
}

export default renderersManager;