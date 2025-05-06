/**
 * TaskCard.base - базовий компонент для відображення картки завдання
 *
 * Відповідає за:
 * - Відображення спільних елементів для всіх типів завдань
 * - Створення та рендеринг основної структури картки
 * - Оновлення відображення статусу та стану
 */

// Імпорт залежностей
import taskActions from './actions.js';
import dependencyContainer from '../../../utils/dependency-container.js';

// DOM шаблон для карточки завдання
const TEMPLATE = `
    <div class="task-header">
        <div class="task-title"></div>
        <div class="task-reward"></div>
    </div>
    <div class="task-description"></div>
    <div class="task-progress-container"></div>
    <div class="task-action"></div>
`;

/**
 * Створення базової картки завдання
 * @param {Object} task - Дані завдання
 * @param {Object} progress - Прогрес виконання
 * @param {Object} options - Додаткові налаштування
 * @returns {HTMLElement} DOM елемент картки
 */
export function create(task, progress, options = {}) {
    if (!task || !task.id) {
        console.error('TaskCard: Отримано некоректні дані завдання');
        return document.createElement('div');
    }

    const isCompleted = progress && progress.status === 'completed';
    const taskElement = document.createElement('div');
    taskElement.className = 'task-item';
    taskElement.dataset.taskId = task.id;
    taskElement.dataset.taskType = task.type || 'default';

    // Додаємо базову структуру
    taskElement.innerHTML = TEMPLATE;

    // Заповнюємо основні елементи
    fillTaskContent(taskElement, task, progress, options);

    // Налаштовуємо статус, класи та обробники подій
    setupTaskStatus(taskElement, task, progress);

    // Додаємо атрибути з опцій
    if (options.customClass) {
        taskElement.classList.add(options.customClass);
    }

    // Налаштовуємо кнопки дій
    taskActions.setupActionButtons(taskElement, task, progress, options);

    return taskElement;
}

/**
 * Заповнення контенту картки завдання
 */
function fillTaskContent(taskElement, task, progress, options) {
    // Заголовок
    const titleElement = taskElement.querySelector('.task-title');
    if (titleElement) {
        titleElement.textContent = task.title || '';
    }

    // Опис
    const descriptionElement = taskElement.querySelector('.task-description');
    if (descriptionElement) {
        descriptionElement.textContent = task.description || '';
    }

    // Винагорода
    const rewardElement = taskElement.querySelector('.task-reward');
    if (rewardElement && task.reward_amount) {
        const isCompleted = progress && progress.status === 'completed';

        if (isCompleted) {
            rewardElement.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
        } else {
            const rewardType = task.reward_type === 'tokens' ? '$WINIX' : 'жетонів';
            rewardElement.innerHTML = `${task.reward_amount} <span class="token-symbol">${rewardType}</span>`;
        }
    }

    // Додаємо прогрес, якщо потрібно
    if (task.target_value > 1) {
        const progressContainer = taskElement.querySelector('.task-progress-container');
        if (progressContainer) {
            renderTaskProgress(progressContainer, task, progress);
        }
    }
}

/**
 * Відображення прогресу завдання
 */
function renderTaskProgress(container, task, progress) {
    // Отримуємо сервіс прогресу
    const TaskProgress = dependencyContainer.resolve('TaskProgress');

    if (TaskProgress && typeof TaskProgress.render === 'function') {
        TaskProgress.render(container, task, progress);
    } else {
        // Запасний варіант, якщо сервіс недоступний
        renderDefaultProgress(container, task, progress);
    }
}

/**
 * Запасний варіант відображення прогресу
 */
function renderDefaultProgress(container, task, progress) {
    const currentValue = progress?.progress_value || 0;
    const maxValue = task.target_value || 100;
    const percent = Math.min(100, Math.max(0, (currentValue / maxValue) * 100));

    container.innerHTML = `
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${percent}%"></div>
        </div>
        <div class="progress-text">
            <span class="progress-value">${currentValue}/${maxValue}</span>
        </div>
    `;
}

/**
 * Налаштування статусу картки завдання
 */
function setupTaskStatus(taskElement, task, progress) {
    // Визначаємо статус завдання
    const isCompleted = progress && progress.status === 'completed';
    const isExpired = task.end_date && new Date(task.end_date) <= new Date();

    // Додаємо відповідні класи
    if (isCompleted) {
        taskElement.classList.add('completed');
    } else if (isExpired) {
        taskElement.classList.add('expired');
    }

    // Додаємо спеціальні класи залежно від типу
    if (task.type) {
        taskElement.classList.add(`${task.type}-task`);
    }
}

/**
 * Оновлення статусу картки завдання
 */
export function updateStatus(taskElement, status) {
    if (!taskElement) return;

    const statusClasses = ['loading', 'completed', 'error', 'in-progress', 'ready-to-verify', 'expired'];

    // Видаляємо всі статусні класи
    statusClasses.forEach(cls => {
        taskElement.classList.remove(cls);
    });

    // Додаємо відповідний клас
    if (status) {
        taskElement.classList.add(status);
    }

    // Оновлюємо вміст елементу дій
    taskActions.updateActionStatus(taskElement, status);
}

/**
 * Функція для безпечного виведення HTML
 */
export function escapeHtml(text) {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Створення списку класів для картки
 * @param {Array} classes - Масив класів
 * @returns {string} Рядок класів
 */
export function createClassList(classes = []) {
    return classes.filter(Boolean).join(' ');
}

/**
 * Отримання елемента картки за ID завдання
 * @param {string} taskId - ID завдання
 * @returns {HTMLElement|null} Елемент картки
 */
export function getTaskElementById(taskId) {
    return document.querySelector(`.task-item[data-task-id="${taskId}"]`);
}

/**
 * Перевірка, чи завдання вже відображено
 * @param {string} taskId - ID завдання
 * @returns {boolean} Результат перевірки
 */
export function isTaskRendered(taskId) {
    return !!getTaskElementById(taskId);
}

/**
 * Оновлення заголовка завдання
 * @param {HTMLElement} taskElement - Елемент картки
 * @param {string} title - Новий заголовок
 */
export function updateTaskTitle(taskElement, title) {
    const titleElement = taskElement.querySelector('.task-title');
    if (titleElement) {
        titleElement.textContent = title;
    }
}

/**
 * Оновлення опису завдання
 * @param {HTMLElement} taskElement - Елемент картки
 * @param {string} description - Новий опис
 */
export function updateTaskDescription(taskElement, description) {
    const descriptionElement = taskElement.querySelector('.task-description');
    if (descriptionElement) {
        descriptionElement.textContent = description;
    }
}

// Експорт за замовчуванням для зворотної сумісності
export default {
    create,
    updateStatus,
    escapeHtml,
    createClassList,
    getTaskElementById,
    isTaskRendered,
    updateTaskTitle,
    updateTaskDescription
};