/**
 * Базова модель завдання
 *
 * Відповідає за:
 * - Зберігання основних даних завдання
 * - Спільну логіку для всіх типів завдань
 */

import { TASK_TYPES, REWARD_TYPES, TASK_STATUS } from '../../config';
import { isValidTask } from './validators.js';
import { formatToDisplayData, formatToApiData } from './formatters.js';
import { generateTrackingUrl } from './tracking.js';

export class TaskModel {
  /**
   * Конструктор базової моделі завдання
   * @param {Object} data - Дані завдання
   */
  constructor(data = {}) {
    // Базові властивості
    this.id = data.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.title = data.title || 'Нове завдання';
    this.description = data.description || 'Опис відсутній';
    this.type = data.type || TASK_TYPES.SOCIAL;
    this.action_type = data.action_type || 'generic';
    this.action_url = data.action_url || '';
    this.action_label = data.action_label || 'Виконати';

    // Налаштування винагороди
    this.reward_type = data.reward_type || REWARD_TYPES.TOKENS;
    this.reward_amount = parseFloat(data.reward_amount) || 10;

    // Налаштування прогресу
    this.target_value = parseInt(data.target_value) || 1;
    this.progress_label = data.progress_label || '';

    // Статус завдання
    this.status = data.status || TASK_STATUS.PENDING;

    // Метадані
    this.created_at = data.created_at || new Date().toISOString();
    this.tags = Array.isArray(data.tags) ? [...data.tags] : [];

    // Додаткові дані, спільні для всіх типів завдань
    this.start_date = data.start_date || new Date().toISOString();
    this.end_date = data.end_date || '';
    this.max_completions = parseInt(data.max_completions) || null;
    this.current_completions = parseInt(data.current_completions) || 0;
    this.priority = parseInt(data.priority) || 1;

    // Дані для партнерських завдань
    this.partner_name = data.partner_name || '';
    this.partner_logo = data.partner_logo || '';
    this.partner_url = data.partner_url || data.action_url || '';
    this.partner_id = data.partner_id || '';
    this.revenue_share = parseFloat(data.revenue_share) || 0;
    this.category = data.category || '';
    this.external_tracking_id = data.external_tracking_id || '';
    this.conversion_type = data.conversion_type || 'visit';

    // Дані для соціальних завдань
    this.platform = data.platform || this.detectPlatform(data.action_url);
    this.channel_name = data.channel_name || '';
    this.channel_url = data.channel_url || data.action_url || '';
    this.platform_user_id = data.platform_user_id || '';
    this.requires_verification = data.requires_verification !== false;

    // Ініціалізація та оновлення даних
    this.updateStatus();
  }

  /**
   * Нормалізація даних завдання
   * @param {Object} data - Дані завдання
   * @returns {Object} Нормалізовані дані
   */
  static normalize(data) {
    if (!data || typeof data !== 'object') {
      return {};
    }

    // Базова нормалізація
    const normalized = {
      id: data.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: data.title || 'Завдання',
      description: data.description || 'Опис відсутній',
      type: data.type || TASK_TYPES.SOCIAL,
    };

    // Нормалізація типу винагороди
    if (data.reward_type) {
      const lowerType = data.reward_type.toLowerCase();
      normalized.reward_type =
        lowerType.includes('token') || lowerType.includes('winix')
          ? REWARD_TYPES.TOKENS
          : REWARD_TYPES.COINS;
    } else {
      normalized.reward_type = REWARD_TYPES.TOKENS;
    }

    // Нормалізація суми винагороди
    normalized.reward_amount = parseFloat(data.reward_amount) || 10;

    // Нормалізація цільового значення
    normalized.target_value = parseInt(data.target_value) || 1;

    return normalized;
  }

  /**
   * Створення екземпляра з даних API
   * @param {Object} apiData - Дані від API
   * @returns {TaskModel} Новий екземпляр завдання
   */
  static fromApiData(apiData) {
    return new TaskModel(TaskModel.normalize(apiData));
  }

  /**
   * Визначення платформи на основі URL
   * @param {string} url - URL дії
   * @returns {string} Тип соціальної мережі
   */
  detectPlatform(url) {
    if (!url) return '';

    url = url.toLowerCase();

    if (url.includes('t.me/') || url.includes('telegram.')) {
      return 'telegram';
    }

    if (url.includes('twitter.') || url.includes('x.com')) {
      return 'twitter';
    }

    if (url.includes('discord.')) {
      return 'discord';
    }

    if (url.includes('facebook.') || url.includes('fb.')) {
      return 'facebook';
    }

    return '';
  }

  /**
   * Оновлення статусу завдання відповідно до часових обмежень
   */
  updateStatus() {
    // Якщо завдання вже виконано, не змінюємо статус
    if (this.status === TASK_STATUS.COMPLETED) {
      return;
    }

    // Перевіряємо, чи не закінчився термін виконання
    if (this.end_date) {
      const endDate = new Date(this.end_date);
      const now = new Date();

      if (endDate <= now) {
        this.status = TASK_STATUS.EXPIRED;
        return;
      }
    }

    // Перевіряємо, чи не перевищено ліміт виконань
    if (this.max_completions !== null && this.current_completions >= this.max_completions) {
      this.status = TASK_STATUS.EXPIRED;
      return;
    }

    // Перевіряємо, чи вже почався термін виконання
    if (this.start_date) {
      const startDate = new Date(this.start_date);
      const now = new Date();

      if (startDate > now) {
        this.status = TASK_STATUS.PENDING;
        return;
      }
    }

    // Якщо все в порядку, статус стає активним
    if (this.status === TASK_STATUS.PENDING || this.status === TASK_STATUS.EXPIRED) {
      this.status = TASK_STATUS.STARTED;
    }
  }

  /**
   * Перевірка, чи завдання активне
   * @returns {boolean} Чи завдання активне
   */
  isActive() {
    this.updateStatus();
    return this.status !== TASK_STATUS.EXPIRED && this.status !== TASK_STATUS.PENDING;
  }

  /**
   * Оновлення даних завдання
   * @param {Object} newData - Нові дані
   * @returns {TaskModel} Оновлена модель
   */
  update(newData) {
    if (!newData || typeof newData !== 'object') {
      return this;
    }

    // Оновлюємо базові властивості
    Object.keys(newData).forEach((key) => {
      if (this.hasOwnProperty(key) && key !== 'id') {
        this[key] = newData[key];
      }
    });

    // Оновлюємо статус
    this.updateStatus();

    return this;
  }

  /**
   * Перетворення в формат для відправки на сервер
   * @returns {Object} Форматовані дані
   */
  toApiData() {
    return formatToApiData(this);
  }

  /**
   * Перетворення в формат для відображення
   * @returns {Object} Дані для відображення
   */
  toDisplayData() {
    return formatToDisplayData(this);
  }

  /**
   * Валідація даних завдання
   * @returns {boolean} Результат валідації
   */
  isValid() {
    return isValidTask(this);
  }

  /**
   * Створення трекінгового URL з UTM-мітками
   * @param {string} userId - ID користувача
   * @returns {string} URL з трекінгом
   */
  getTrackingUrl(userId) {
    return generateTrackingUrl(this, userId);
  }
}
