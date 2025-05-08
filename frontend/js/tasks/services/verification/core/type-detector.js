/**
 * Визначник типів завдань
 *
 * Відповідає за:
 * - Визначення типу завдання за різними параметрами
 * - Аналіз URL та контенту для визначення типу
 * - Використання DOM для визначення типу
 */

import { TASK_TYPES, SOCIAL_NETWORKS } from '../../../config/index.js';
import { getLogger } from '../../../utils/core/logger.js';
import { getCachedTaskType, cacheTaskType } from './cache-manager.js';

// Створюємо логер для модуля
const logger = getLogger('TypeDetector');

/**
 * Отримання типу завдання за ID
 * @param {string} taskId - ID завдання
 * @param {Object} taskStore - Сховище завдань (опційно)
 * @returns {string} Тип завдання
 */
export function getTaskType(taskId, taskStore) {
  try {
    // Перевіряємо кеш спочатку
    const cachedType = getCachedTaskType(taskId);
    if (cachedType) {
      return cachedType;
    }

    // Спочатку використовуємо сховище завдань, якщо воно доступне
    if (taskStore && typeof taskStore.findTaskById === 'function') {
      const task = taskStore.findTaskById(taskId);
      if (task) {
        // Кешуємо тип
        cacheTaskType(taskId, task.type);
        return task.type;
      }
    }

    // Визначаємо тип за префіксом ID
    const determinedType = determineTypeByPrefix(taskId);
    if (determinedType !== 'unknown') {
      cacheTaskType(taskId, determinedType);
      return determinedType;
    }

    // Спробуємо визначити тип за DOM
    const typeFromDOM = determineTypeFromDOM(taskId);
    if (typeFromDOM !== 'unknown') {
      cacheTaskType(taskId, typeFromDOM);
      return typeFromDOM;
    }

    // Якщо тип не визначено
    logger.warn(`Не вдалося визначити тип завдання ${taskId}`, 'getTaskType');
    return 'unknown';
  } catch (error) {
    logger.error(`Помилка при визначенні типу завдання ${taskId}:`, error);
    return 'unknown';
  }
}

/**
 * Визначення типу завдання за префіксом ID
 * @param {string} taskId - ID завдання
 * @returns {string} Тип завдання
 */
export function determineTypeByPrefix(taskId) {
  if (!taskId) return 'unknown';

  // Приводимо ID до рядка та нижнього регістру
  const id = String(taskId).toLowerCase();

  // Перевіряємо префікси
  if (id.startsWith('social_')) {
    return TASK_TYPES.SOCIAL;
  }

  if (id.startsWith('limited_')) {
    return TASK_TYPES.LIMITED;
  }

  if (id.startsWith('partner_')) {
    return TASK_TYPES.PARTNER;
  }

  if (id.startsWith('referral_')) {
    return TASK_TYPES.REFERRAL;
  }

  // Перевіряємо вмісті ідентифікатора на ключові слова
  if (id.includes('social') || id.includes('telegram') || id.includes('twitter') || id.includes('discord')) {
    return TASK_TYPES.SOCIAL;
  }

  if (id.includes('limited') || id.includes('time') || id.includes('deadline')) {
    return TASK_TYPES.LIMITED;
  }

  if (id.includes('partner') || id.includes('sponsor')) {
    return TASK_TYPES.PARTNER;
  }

  if (id.includes('referral') || id.includes('ref') || id.includes('invite')) {
    return TASK_TYPES.REFERRAL;
  }

  return 'unknown';
}

/**
 * Визначення типу завдання за DOM елементами
 * @param {string} taskId - ID завдання
 * @returns {string} Тип завдання
 */
export function determineTypeFromDOM(taskId) {
  try {
    if (typeof document === 'undefined') {
      return 'unknown';
    }

    // Знаходимо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) {
      return 'unknown';
    }

    // Перевіряємо атрибут data-task-type
    const taskType = taskElement.getAttribute('data-task-type');
    if (taskType && Object.values(TASK_TYPES).includes(taskType)) {
      return taskType;
    }

    // Перевіряємо класи елемента
    const classList = Array.from(taskElement.classList);
    if (classList.includes('social-task')) return TASK_TYPES.SOCIAL;
    if (classList.includes('limited-task')) return TASK_TYPES.LIMITED;
    if (classList.includes('partner-task')) return TASK_TYPES.PARTNER;
    if (classList.includes('referral-task')) return TASK_TYPES.REFERRAL;

    // Визначаємо тип за контейнером
    const parentElement = taskElement.parentElement;
    if (parentElement) {
      const socialsContainer = document.getElementById('social-tasks-container');
      const limitedContainer = document.getElementById('limited-tasks-container');
      const partnersContainer = document.getElementById('partners-tasks-container');
      const referralContainer = document.getElementById('referral-tasks-container');

      if (socialsContainer && socialsContainer.contains(taskElement)) return TASK_TYPES.SOCIAL;
      if (limitedContainer && limitedContainer.contains(taskElement)) return TASK_TYPES.LIMITED;
      if (partnersContainer && partnersContainer.contains(taskElement)) return TASK_TYPES.PARTNER;
      if (referralContainer && referralContainer.contains(taskElement)) return TASK_TYPES.REFERRAL;

      // Перевіряємо класи батьківського елемента
      const parentClasses = Array.from(parentElement.classList);
      if (parentClasses.includes('social-tasks')) return TASK_TYPES.SOCIAL;
      if (parentClasses.includes('limited-tasks')) return TASK_TYPES.LIMITED;
      if (parentClasses.includes('partner-tasks')) return TASK_TYPES.PARTNER;
      if (parentClasses.includes('referral-tasks')) return TASK_TYPES.REFERRAL;
    }

    // Перевіряємо вміст завдання на ключові слова
    const taskContent = taskElement.textContent.toLowerCase();
    if (taskContent.includes('telegram') || taskContent.includes('twitter') || taskContent.includes('discord')) {
      return TASK_TYPES.SOCIAL;
    }

    if (taskContent.includes('обмежен') || taskContent.includes('deadline') || taskContent.includes('limited')) {
      return TASK_TYPES.LIMITED;
    }

    if (taskContent.includes('партнер') || taskContent.includes('partner') || taskContent.includes('sponsor')) {
      return TASK_TYPES.PARTNER;
    }

    if (taskContent.includes('реферал') || taskContent.includes('запроси') || taskContent.includes('invite')) {
      return TASK_TYPES.REFERRAL;
    }

    return 'unknown';
  } catch (error) {
    logger.error(`Помилка при визначенні типу з DOM для завдання ${taskId}:`, error);
    return 'unknown';
  }
}

/**
 * Визначення типу соціальної мережі для завдання
 * @param {Object} task - Дані завдання
 * @returns {string|null} Тип соціальної мережі
 */
export function determineSocialNetworkType(task) {
  if (!task) return null;

  try {
    // Якщо тип платформи вже вказано
    if (task.platform) {
      return task.platform;
    }

    // Аналіз URL та тексту для визначення типу
    const url = (task.channel_url || task.action_url || '').toLowerCase();
    const title = (task.title || '').toLowerCase();
    const description = (task.description || '').toLowerCase();

    // Перевірка на Telegram
    if (
      url.includes('t.me/') ||
      url.includes('telegram.') ||
      title.includes('telegram') ||
      description.includes('telegram')
    ) {
      return SOCIAL_NETWORKS.TELEGRAM;
    }

    // Перевірка на Twitter
    if (
      url.includes('twitter.') ||
      url.includes('x.com') ||
      title.includes('twitter') ||
      description.includes('twitter')
    ) {
      return SOCIAL_NETWORKS.TWITTER;
    }

    // Перевірка на Discord
    if (
      url.includes('discord.') ||
      title.includes('discord') ||
      description.includes('discord')
    ) {
      return SOCIAL_NETWORKS.DISCORD;
    }

    // Перевірка на Facebook
    if (
      url.includes('facebook.') ||
      url.includes('fb.') ||
      title.includes('facebook') ||
      description.includes('facebook')
    ) {
      return SOCIAL_NETWORKS.FACEBOOK;
    }

    return null;
  } catch (error) {
    logger.error('Помилка при визначенні типу соціальної мережі:', error);
    return null;
  }
}

export default {
  getTaskType,
  determineTypeByPrefix,
  determineTypeFromDOM,
  determineSocialNetworkType
};