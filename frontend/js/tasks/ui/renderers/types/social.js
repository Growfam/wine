/**
 * Social - рендерер для соціальних завдань
 *
 * Відповідає за:
 * - Відображення соціальних завдань
 * - Оптимізоване відображення для високої продуктивності
 * - Взаємодію з системою перевірки соціальних мереж
 *
 * @version 4.0.0
 */

import BaseRenderer, { TASK_STATUS } from 'js/tasks/ui//renderers/base.js';
import dependencyContainer from 'js/tasks/utils/index.js';

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
  REDDIT: 'reddit',
};

// Експортуємо як константу для сумісності з іншими частинами системи
export const SUPPORTED_NETWORKS = SOCIAL_NETWORKS;

/**
 * Визначення типу соціальної мережі за URL
 * @param {string} url - URL для аналізу
 * @returns {string|null} Тип соціальної мережі або null
 */
export function detectNetworkType(url) {
  if (!url) return null;

  // Нормалізуємо URL
  const normalizedUrl = url.toLowerCase();

  // Визначаємо тип мережі за доменом
  if (normalizedUrl.includes('t.me') || normalizedUrl.includes('telegram')) {
    return SOCIAL_NETWORKS.TELEGRAM;
  }
  if (normalizedUrl.includes('twitter') || normalizedUrl.includes('x.com')) {
    return SOCIAL_NETWORKS.TWITTER;
  }
  if (normalizedUrl.includes('facebook') || normalizedUrl.includes('fb.com')) {
    return SOCIAL_NETWORKS.FACEBOOK;
  }
  if (normalizedUrl.includes('instagram')) {
    return SOCIAL_NETWORKS.INSTAGRAM;
  }
  if (normalizedUrl.includes('discord')) {
    return SOCIAL_NETWORKS.DISCORD;
  }
  if (normalizedUrl.includes('youtube') || normalizedUrl.includes('youtu.be')) {
    return SOCIAL_NETWORKS.YOUTUBE;
  }
  if (normalizedUrl.includes('tiktok')) {
    return SOCIAL_NETWORKS.TIKTOK;
  }
  if (normalizedUrl.includes('linkedin')) {
    return SOCIAL_NETWORKS.LINKEDIN;
  }
  if (normalizedUrl.includes('reddit')) {
    return SOCIAL_NETWORKS.REDDIT;
  }

  return null;
}

/**
 * Отримання іконки соціальної мережі
 * @param {string} networkType - Тип соціальної мережі
 * @returns {string} Клас іконки або порожній рядок
 */
export function getSocialIcon(networkType) {
  if (!networkType) return '';
  return `${networkType}-icon`;
}

/**
 * Перевірка безпеки URL
 * @param {string} url - URL для перевірки
 * @returns {boolean} Чи є URL безпечним
 */
export function isUrlSafe(url) {
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

    // Перевіряємо на відомі небезпечні домени
    const blockedDomains = ['evil.com', 'malware.com', 'phishing.com'];

    for (const domain of blockedDomains) {
      if (urlObj.hostname.includes(domain)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Екранування HTML для безпечного відображення
 * @param {string} text - Текст для екранування
 * @returns {string} Екранований текст
 */
export function escapeHTML(text) {
  if (!text) return '';

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Рендерер для соціальних завдань
 */
class Social extends BaseRenderer {
  /**
   * Створення екземпляру Social
   */
  constructor() {
    super('SocialRenderer');
  }

  /**
   * Отримання опцій для рендерингу
   * @param {Object} task - Завдання
   * @returns {Object} Опції для рендерингу
   */
  getTaskCardOptions(task) {
    // Визначаємо тип соціальної мережі
    const networkType = detectNetworkType(task.action_url);

    return {
      customClass: 'social-task',
      allowVerification: true,
      networkType,
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

      // Додаємо інформацію після опису завдання
      const descriptionElement = taskElement.querySelector('.task-description');
      if (descriptionElement) {
        descriptionElement.parentNode.insertBefore(infoElement, descriptionElement.nextSibling);
      } else {
        taskElement.appendChild(infoElement);
      }
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
const socialRenderer = new Social();

// Для зворотної сумісності: створюємо об'єкт з прямим доступом до методів
if (typeof window !== 'undefined') {
  window.SocialRenderer = {
    render: (task, progress, options) => socialRenderer.render(task, progress, options),
    refreshTaskDisplay: (taskId) => socialRenderer.refreshTaskDisplay(taskId),
    refreshAllTasks: () => socialRenderer.refreshAllTasks(),
    updateTaskStatus: (taskElement, status) => socialRenderer.updateTaskStatus(taskElement, status),
    detectNetworkType,
    validateSocialUrl: (url) => socialRenderer.validateSocialUrl(url),
    SOCIAL_NETWORKS,
    STATUS: TASK_STATUS,
    initialize: () => socialRenderer.initialize(),
  };
}

// Експортуємо за замовчуванням
export default socialRenderer;