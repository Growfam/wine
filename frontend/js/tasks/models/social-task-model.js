/**
 * Модель соціального завдання
 *
 * Розширює базову модель для соціальних завдань
 */

import { TaskModel } from './task-model.js';
import { TASK_TYPES } from '../config/task-types.js';

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
}

export default SocialTaskModel;