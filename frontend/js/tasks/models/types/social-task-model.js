/**
 * Модель соціального завдання
 *
 * Розширює базову модель для соціальних завдань
 */

import { TaskModel } from '../base';
import { TASK_TYPES } from '../../config';

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
  }

  /**
   * Створення екземпляра з даних API
   * @param {Object} apiData - Дані від API
   * @returns {SocialTaskModel} Новий екземпляр соціального завдання
   */
  static fromApiData(apiData) {
    // Нормалізуємо дані
    const normalizedData = TaskModel.normalize(apiData);

    // Створюємо екземпляр з доданням специфічних даних
    return new SocialTaskModel({
      ...normalizedData,
      platform: apiData.platform,
      channel_name: apiData.channel_name,
      channel_url: apiData.channel_url || apiData.action_url,
      platform_user_id: apiData.platform_user_id,
      requires_verification: apiData.requires_verification !== false
    });
  }

  /**
   * Визначення типу соціальної мережі на основі URL
   * @returns {string} Тип соціальної мережі
   */
  getSocialPlatformType() {
    // Намагаємося визначити тип платформи
    if (this.platform) return this.platform;

    // Спробуємо визначити на основі URL
    return this.detectPlatform(this.channel_url || this.action_url);
  }

  /**
   * Перевірка, чи потрібна верифікація
   * @returns {boolean} Потрібна верифікація чи ні
   */
  needsVerification() {
    return this.requires_verification === true;
  }
}

export default SocialTaskModel;