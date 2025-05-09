/**
 * SocialTaskCard - компонент для відображення соціальних завдань
 *
 * Відповідає за:
 * - Спеціалізовані картки для соціальних завдань
 * - Відображення іконок соціальних мереж
 * - Додатковий UI для цього типу завдань
 */

import { create as createBaseCard } from 'js/tasks/ui/components/card/base.js';
import { setupActionButtons } from 'js/tasks/ui/components/card/actions.js';

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
 * Створення картки соціального завдання
 * @param {Object} task - Дані завдання
 * @param {Object} progress - Прогрес виконання
 * @param {Object} options - Додаткові налаштування
 * @returns {HTMLElement} DOM елемент картки
 */
export function create(task, progress, options = {}) {
  // Визначення мережі
  const networkType = detectNetworkType(task.action_url);

  // Створюємо базову картку
  const taskElement = createBaseCard(task, progress, {
    ...options,
    customClass: `social-task ${networkType ? `network-${networkType}` : ''}`,
  });

  // Додаємо додаткові атрибути
  if (networkType) {
    taskElement.dataset.network = networkType;
  }

  if (task.action_url) {
    taskElement.dataset.actionUrl = task.action_url;
  }

  // Додаємо іконку соціальної мережі
  if (networkType) {
    const headerElement = taskElement.querySelector('.task-header');
    if (headerElement) {
      const iconElement = document.createElement('div');
      iconElement.className = `social-network-icon ${networkType}-icon`;

      // Додаємо іконку перед заголовком
      headerElement.insertBefore(iconElement, headerElement.firstChild);
    }
  }

  // Додаємо інформацію про соціальну мережу
  if (task.action_url) {
    const infoElement = document.createElement('div');
    infoElement.className = 'social-url-info';

    // Спрощуємо URL для відображення
    let displayUrl = '';
    try {
      const urlObj = new URL(task.action_url);
      displayUrl = urlObj.hostname;
    } catch (e) {
      displayUrl = 'social-site';
    }

    infoElement.innerHTML = `
            <span class="social-site-label">Посилання:</span> 
            <span class="social-site-domain">${displayUrl}</span>
        `;

    // Додаємо інформацію після опису
    const descriptionElement = taskElement.querySelector('.task-description');
    if (descriptionElement) {
      taskElement.insertBefore(infoElement, descriptionElement.nextSibling);
    }
  }

  // Налаштовуємо кнопки дій
  setupActionButtons(taskElement, task, progress, {
    allowVerification: true,
    networkType,
  });

  return taskElement;
}

// Експортуємо публічне API
export default { create, detectNetworkType, SOCIAL_NETWORKS };
