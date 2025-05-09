/**
 * Partner - рендерер для партнерських завдань
 *
 * Відповідає за:
 * - Безпечне відображення партнерських завдань
 * - Інтеграцію з CSRF захистом для партнерських переходів
 * - Безпечну обробку партнерських посилань
 * @version 4.1.0
 */

import BaseRenderer, { TASK_STATUS } from 'js/tasks/ui/renderers/base.js';

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
 * Рендерер для партнерських завдань
 */
class Partner extends BaseRenderer {
  /**
   * Створення екземпляру Partner
   */
  constructor() {
    super('PartnerRenderer');
  }

  /**
   * Отримання опцій для TaskCard
   * @param {Object} task - Завдання
   * @returns {Object} Опції для TaskCard
   */
  getTaskCardOptions(task) {
    return {
      customClass: 'partner-task',
      allowVerification: true,
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

    // Додаємо специфічні атрибути для партнерського завдання
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
  }

  /**
   * Додавання специфічних елементів для партнерського завдання
   * @param {HTMLElement} taskElement - Елемент завдання
   * @param {Object} task - Завдання
   * @param {Object} progress - Прогрес
   * @param {Object} options - Опції рендерингу
   */
  enhanceTaskElement(taskElement, task, progress, options) {
    // Додаємо мітку партнера, якщо вказано
    if (task.partner_name) {
      const partnerLabel = document.createElement('div');
      partnerLabel.className = 'partner-label';
      partnerLabel.textContent = `Партнер: ${this.escapeHTML(task.partner_name)}`;

      // Додаємо мітку на початок елемента
      if (taskElement.firstChild) {
        taskElement.insertBefore(partnerLabel, taskElement.firstChild);
      } else {
        taskElement.appendChild(partnerLabel);
      }
    }

    // Перевіряємо URL на безпеку
    let safeUrl = null;
    if (task.action_url) {
      safeUrl = isUrlSafe(task.action_url) ? task.action_url : null;
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
                <span class="partner-site-domain">${this.escapeHTML(displayUrl)}</span>
            `;

      // Додаємо інформацію в кінець елемента
      taskElement.appendChild(urlInfo);
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
    const task = {
      id: taskId,
      action_url: taskElement.dataset.actionUrl,
      partner_name: taskElement.dataset.partnerName,
    };

    // Показуємо підтвердження переходу на сайт партнера
    if (task.action_url && task.partner_name) {
      if (
        confirm(
          `Ви будете перенаправлені на сайт партнера "${task.partner_name || 'WINIX'}". Продовжити?`
        )
      ) {
        // Генеруємо CSRF токен
        const csrfToken = generateCsrfToken(task.id);

        // Додаємо CSRF токен до URL
        let safeUrl = task.action_url;
        try {
          const urlObj = new URL(safeUrl);

          // Додаємо основні параметри
          urlObj.searchParams.append('csrf_token', csrfToken);
          urlObj.searchParams.append('task_id', task.id);
          urlObj.searchParams.append('ts', Date.now());

          safeUrl = urlObj.toString();

          // Додаткова перевірка безпеки модифікованого URL
          if (!isUrlSafe(safeUrl)) {
            throw new Error('Модифікований URL не пройшов перевірку безпеки');
          }
        } catch (e) {
          this.log('error', 'Помилка при додаванні параметрів до URL', { error: e });
          this.showErrorMessage('Не вдалося безпечно обробити URL партнера');
          return;
        }

        // Відкриваємо URL у новому вікні з налаштуваннями безпеки
        const windowFeatures = 'noopener,noreferrer';
        const newWindow = window.open(safeUrl, '_blank', windowFeatures);

        // Додаткова перевірка, чи відкрилося нове вікно
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          this.showErrorMessage(
            'Браузер заблокував спливаюче вікно. Дозвольте спливаючі вікна для цього сайту.'
          );
          return;
        }

        // Додаткова безпека - розриваємо зв'язок з відкритим вікном
        newWindow.opener = null;

        // Змінюємо відображення кнопок
        this.updateTaskStatus(taskElement, TASK_STATUS.READY_TO_VERIFY);

        // Викликаємо базовий метод для запуску завдання в API
        super.handleStartTask(taskId, taskElement);

        this.showSuccessMessage('Завдання розпочато! Виконайте необхідні дії на сайті партнера.');
      }
    } else {
      // Якщо немає URL, просто запускаємо завдання
      super.handleStartTask(taskId, taskElement);
    }
  }

  /**
   * Функція для безпечного виведення HTML
   * @param {string} text - Текст для обробки
   * @returns {string} Безпечний HTML
   */
  escapeHTML(text) {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Створюємо єдиний екземпляр
const partnerRenderer = new Partner();
export default partnerRenderer;
