/**
 * Модель соціального завдання
 *
 * Розширює базову модель для соціальних завдань
 */

import { TaskModel } from './task-model.js';
import { TASK_TYPES, SOCIAL_NETWORKS, ACTION_TYPES } from '../config/task-types.js';

export class SocialTaskModel extends TaskModel {
  /**
   * Конструктор моделі соціального завдання
   * @param {Object} data - Дані завдання
   */
  constructor(data = {}) {
    // Викликаємо батьківський конструктор
    super(data);

    // Встановлюємо тип завдання
    this.type = TASK_TYPES.SOCIAL;

    // Розширюємо додатковими властивостями
    this.platform = data.platform || this.detectPlatform(data.action_url);
    this.action_type = data.action_type || ACTION_TYPES.VISIT;
    this.channel_name = data.channel_name || '';
    this.channel_url = data.channel_url || data.action_url || '';
    this.platform_user_id = data.platform_user_id || '';
    this.requires_verification = data.requires_verification !== false;
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
      return SOCIAL_NETWORKS.TELEGRAM;
    }

    if (url.includes('twitter.') || url.includes('x.com')) {
      return SOCIAL_NETWORKS.TWITTER;
    }

    if (url.includes('discord.')) {
      return SOCIAL_NETWORKS.DISCORD;
    }

    if (url.includes('facebook.') || url.includes('fb.')) {
      return SOCIAL_NETWORKS.FACEBOOK;
    }

    return '';
  }

  /**
   * Перетворення в формат для відправки на сервер
   * @returns {Object} Форматовані дані
   */
  toApiData() {
    // Отримуємо базові дані
    const baseData = super.toApiData();

    // Додаємо специфічні дані
    return {
      ...baseData,
      platform: this.platform,
      channel_name: this.channel_name,
      channel_url: this.channel_url,
      platform_user_id: this.platform_user_id,
      requires_verification: this.requires_verification
    };
  }

  /**
   * Перетворення в формат для відображення
   * @returns {Object} Дані для відображення
   */
  toDisplayData() {
    // Отримуємо базові дані
    const baseData = super.toDisplayData();

    // Додаємо іконку платформи
    let platformIcon = '';
    switch (this.platform) {
      case SOCIAL_NETWORKS.TELEGRAM:
        platformIcon = '📱';
        break;
      case SOCIAL_NETWORKS.TWITTER:
        platformIcon = '🐦';
        break;
      case SOCIAL_NETWORKS.DISCORD:
        platformIcon = '💬';
        break;
      case SOCIAL_NETWORKS.FACEBOOK:
        platformIcon = '👍';
        break;
      default:
        platformIcon = '🌐';
    }

    // Додаємо специфічні дані
    return {
      ...baseData,
      platform: this.platform,
      platformIcon,
      channel_name: this.channel_name,
      action_type: this.action_type
    };
  }

  /**
   * Валідація даних соціального завдання
   * @returns {boolean} Результат валідації
   */
  isValid() {
    // Викликаємо базову валідацію
    if (!super.isValid()) {
      return false;
    }

    // Валідація URL
    if (this.requires_verification && !this.channel_url) {
      return false;
    }

    return true;
  }

  /**
   * Створення екземпляра з даних API
   * @param {Object} apiData - Дані від API
   * @returns {SocialTaskModel} Новий екземпляр соціального завдання
   */
  static fromApiData(apiData) {
    // Нормалізуємо дані
    const normalizedData = TaskModel.normalize(apiData);

    // Створюємо екземпляр
    return new SocialTaskModel({
      ...normalizedData,
      platform: apiData.platform,
      channel_name: apiData.channel_name,
      channel_url: apiData.channel_url || apiData.action_url,
      platform_user_id: apiData.platform_user_id,
      requires_verification: apiData.requires_verification !== false
    });
  }
}

export default SocialTaskModel;