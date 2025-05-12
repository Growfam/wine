/**
 * PartnerTaskCard - компонент для відображення партнерських завдань
 *
 * Відповідає за:
 * - Спеціалізовані картки для партнерських завдань
 * - Безпечне відображення партнерської інформації
 * - Додатковий UI для цього типу завдань
 */

import { create as createBaseCard } from '../base.js';
import { setupActionButtons } from '../actions.js';

// Налаштування безпеки для партнерських доменів
export const ALLOWED_DOMAINS = [
  'winix.com',
  'winix.io',
  'winix-partners.com',
  't.me',
  'twitter.com',
  'discord.gg',
  'exchange.example.com',
  'coinvote.cc',
];

// Блоковані схеми URL
export const BLOCKED_SCHEMES = [
  'data:',
  'file:',
  'ftp:',
  'ws:',
  'wss:',
  'javascript:',
  'vbscript:',
  'blob:',
];

/**
 * Перевірка безпеки URL
 * @param {string} url - URL для перевірки
 * @param {Array} allowedDomains - Дозволені домени
 * @returns {boolean} Результат перевірки
 */
export function isUrlSafe(url, allowedDomains = ALLOWED_DOMAINS) {
  try {
    // Перевіряємо, чи URL не пустий
    if (!url) return false;

    // Створюємо об'єкт URL для аналізу
    const urlObj = new URL(url);

    // Перевіряємо схему
    if (BLOCKED_SCHEMES.includes(urlObj.protocol.toLowerCase())) {
      return false;
    }

    // Перевіряємо домен
    const domain = urlObj.hostname.toLowerCase();
    return allowedDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
  } catch (error) {
    // Якщо URL невалідний, повертаємо false
    return false;
  }
}

/**
 * Генерація CSRF токена для партнерського завдання
 * @param {string} taskId - ID завдання
 * @returns {string} CSRF токен
 */
export function generateCsrfToken(taskId) {
  // Проста реалізація генерації токена
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${taskId}_${timestamp}_${random}`;
}

/**
 * Створення картки партнерського завдання
 * @param {Object} task - Дані завдання
 * @param {Object} progress - Прогрес виконання
 * @param {Object} options - Додаткові налаштування
 * @returns {HTMLElement} DOM елемент картки
 */
export function create(task, progress, options = {}) {
  // Створюємо базову картку
  const taskElement = createBaseCard(task, progress, {
    ...options,
    customClass: 'partner-task',
  });

  // Додаємо додаткові атрибути
  taskElement.dataset.taskType = 'partner';

  // Якщо є партнер, додаємо його дані
  if (task.partner_name) {
    taskElement.dataset.partnerName = task.partner_name;
  }

  // Перевіряємо URL на безпеку
  let safeUrl = null;
  if (task.action_url) {
    safeUrl = isUrlSafe(task.action_url) ? task.action_url : null;
  }

  // Якщо є безпечний URL, додаємо його
  if (safeUrl) {
    taskElement.dataset.actionUrl = safeUrl;
  }

  // Додаємо мітку партнера, якщо вказано
  if (task.partner_name) {
    const partnerLabel = document.createElement('div');
    partnerLabel.className = 'partner-label';
    partnerLabel.textContent = `Партнер: ${escapeHTML(task.partner_name)}`;

    // Додаємо мітку на початок елемента
    if (taskElement.firstChild) {
      taskElement.insertBefore(partnerLabel, taskElement.firstChild);
    } else {
      taskElement.appendChild(partnerLabel);
    }
  }

  // Додаємо інформацію про URL, якщо він безпечний
  if (safeUrl) {
    // Безпечно форматуємо URL для відображення
    let displayUrl = '';
    try {
      const urlObj = new URL(safeUrl);
      displayUrl = urlObj.hostname;
    } catch (e) {
      displayUrl = 'partner-site';
    }

    const urlInfo = document.createElement('div');
    urlInfo.className = 'partner-url-info';
    urlInfo.innerHTML = `
            <span class="partner-site-label">Сайт партнера:</span> 
            <span class="partner-site-domain">${escapeHTML(displayUrl)}</span>
        `;

    // Додаємо інформацію після опису
    const descriptionElement = taskElement.querySelector('.task-description');
    if (descriptionElement) {
      taskElement.insertBefore(urlInfo, descriptionElement.nextSibling);
    }
  }

  // Налаштовуємо кнопки дій
  setupActionButtons(taskElement, task, progress, {
    allowVerification: true,
    isSafeUrl: !!safeUrl,
  });

  return taskElement;
}

/**
 * Безпечне відображення HTML
 * @param {string} text - Текст для обробки
 * @returns {string} Безпечний HTML
 */
export function escapeHTML(text) {
  if (!text) return '';

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Експортуємо публічне API
export default { create, isUrlSafe, generateCsrfToken, ALLOWED_DOMAINS, BLOCKED_SCHEMES };
