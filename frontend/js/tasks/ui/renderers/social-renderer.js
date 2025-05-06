/**
 * SocialRenderer - рендерер для соціальних завдань
 *
 * Відповідає за:
 * - Відображення соціальних завдань
 * - Інтеграцію з системою перевірки соціальних мереж
 * - Оптимізоване відображення для високої продуктивності
 * @version 4.0.0
 */

import BaseRenderer, { TASK_STATUS } from './common/base-renderer.js';
import { detectNetworkType, escapeHTML, isUrlSafe } from './common/utils.js';
import dependencyContainer from '../../utils/dependency-container.js';

// Типи соціальних мереж
export const SOCIAL_NETWORKS = {
    TELEGRAM: 'telegram',
    TWITTER: 'twitter',
    FACEBOOK: 'facebook',
    INSTAGRAM: 'instagram',
    DISCORD: 'discord',
    YOUTUBE: 'youtube',
    TIKTOK: 'tiktok',
    LINKEDIN: 'linkedin',
    REDDIT: 'reddit'
};

/**
 * Рендерер для соціальних завдань
 */
class SocialRenderer extends BaseRenderer {
    /**
     * Створення екземпляру SocialRenderer
     */
    constructor() {
        super('SocialRenderer');
    }

    /**
     * Отримання опцій для TaskCard
     * @param {Object} task - Завдання
     * @returns {Object} Опції для TaskCard
     */
    getTaskCardOptions(task) {
        // Визначаємо тип соціальної мережі
        const networkType = detectNetworkType(task.action_url);

        return {
            customClass: 'social-task',
            allowVerification: true,
            networkType
        };
    }

    /**
     * Додавання атрибутів до елемента завдання
     * @param {HTMLElement} taskElement - Елемент завдання
     * @param {Object} task - Завдання
     * @param {Object} options - Опції рендерингу
     */
    addTaskAttributes(taskElement, task, options) {
        // Викликаємо базовий метод
        super.addTaskAttributes(taskElement, task, options);

        // Додаємо специфічні атрибути для соціального завдання
        if (options.networkType) {
            taskElement.dataset.network = options.networkType;
            taskElement.classList.add(`network-${options.networkType}`);
        }

        // Якщо є URL дії, безпечно додаємо його
        if (task.action_url && isUrlSafe(task.action_url)) {
            taskElement.dataset.actionUrl = task.action_url;
        }
    }

    /**
     * Додавання специфічних елементів для соціального завдання
     * @param {HTMLElement} taskElement - Елемент завдання
     * @param {Object} task - Завдання
     * @param {Object} progress - Прогрес
     * @param {Object} options - Опції рендерингу
     */
    enhanceTaskElement(taskElement, task, progress, options) {
        // Додаємо іконку соціальної мережі, якщо відома
        const networkType = options.networkType || detectNetworkType(task.action_url);

        if (networkType) {
            const headerElement = taskElement.querySelector('.task-header');
            if (headerElement) {
                const iconElement = document.createElement('div');
                iconElement.className = `social-network-icon ${networkType}-icon`;

                // Додаємо іконку перед заголовком
                if (headerElement.firstChild) {
                    headerElement.insertBefore(iconElement, headerElement.firstChild);
                } else {
                    headerElement.appendChild(iconElement);
                }
            }
        }

        // Додаємо інформацію про URL, якщо є
        if (task.action_url && isUrlSafe(task.action_url)) {
            const infoElement = document.createElement('div');
            infoElement.className = 'social-url-info';

            // Безпечно форматуємо URL для відображення
            let displayUrl = '';
            try {
                const urlObj = new URL(task.action_url);
                displayUrl = urlObj.hostname;
            } catch (e) {
                displayUrl = 'social-site';
            }

            infoElement.innerHTML = `
                <span class="social-site-label">Посилання:</span> 
                <span class="social-site-domain">${escapeHTML(displayUrl)}</span>
            `;

            // Додаємо інформацію після кнопок дій
            taskElement.appendChild(infoElement);
        }

        // Викликаємо базовий метод для встановлення статусу
        super.enhanceTaskElement(taskElement, task, progress, options);
    }

    /**
     * Обробник запуску завдання
     * @param {string} taskId - ID завдання
     * @param {HTMLElement} taskElement - Елемент завдання
     */
    handleStartTask(taskId, taskElement) {
        // Отримуємо дані для запуску
        const actionUrl = taskElement.dataset.actionUrl;

        // Якщо є URL дії, відкриваємо його
        if (actionUrl && isUrlSafe(actionUrl)) {
            window.open(actionUrl, '_blank', 'noopener,noreferrer');

            // Оновлюємо статус
            setTimeout(() => {
                this.updateTaskStatus(taskElement, TASK_STATUS.READY_TO_VERIFY);
            }, 500);
        }

        // Викликаємо базовий метод для запуску завдання
        super.handleStartTask(taskId, taskElement);
    }

    /**
     * Валідація URL соціальної мережі
     * @param {string} url - URL для перевірки
     * @returns {boolean} Результат перевірки
     */
    validateSocialUrl(url) {
        if (!url) return false;

        try {
            // Нормалізуємо URL
            let normalizedUrl = url.trim();

            // Додаємо https:// якщо URL не має протоколу
            if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                normalizedUrl = `https://${normalizedUrl}`;
            }

            // Перевіряємо валідність URL
            const urlObj = new URL(normalizedUrl);

            // Перевіряємо, чи схема є http або https
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }
}

// Створюємо єдиний екземпляр
const socialRenderer = new SocialRenderer();

// Для зворотної сумісності зі старим кодом
window.SocialRenderer = {
    render: socialRenderer.render.bind(socialRenderer),
    refreshTaskDisplay: socialRenderer.refreshTaskDisplay.bind(socialRenderer),
    refreshAllTasks: socialRenderer.refreshAllTasks.bind(socialRenderer),
    updateTaskStatus: socialRenderer.updateTaskStatus.bind(socialRenderer),
    detectNetworkType: detectNetworkType,
    validateSocialUrl: socialRenderer.validateSocialUrl.bind(socialRenderer),
    SOCIAL_NETWORKS,
    STATUS: TASK_STATUS,
    initialize: socialRenderer.initialize.bind(socialRenderer)
};

// Експортуємо за замовчуванням
export default socialRenderer;