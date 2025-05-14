/**
 * Модель партнерського завдання
 *
 * Розширює базову модель для партнерських завдань
 */

import { TaskModel } from '../base/task-model.js';
import { TASK_TYPES } from '../../config/task-types.js';

export class PartnerTaskModel extends TaskModel {
  /**
   * Конструктор моделі партнерського завдання
   * @param {Object} data - Дані завдання
   */
  constructor(data = {}) {
    // Викликаємо батьківський конструктор
    super(data);

    // Встановлюємо тип завдання
    this.type = TASK_TYPES.PARTNER;
  }

  /**
   * Створення екземпляра з даних API
   * @param {Object} apiData - Дані від API
   * @returns {PartnerTaskModel} Новий екземпляр партнерського завдання
   */
  static fromApiData(apiData) {
    // Нормалізуємо дані
    const normalizedData = TaskModel.normalize(apiData);

    // Створюємо екземпляр з доданням специфічних даних
    return new PartnerTaskModel({
      ...normalizedData,
      partner_name: apiData.partner_name,
      partner_logo: apiData.partner_logo,
      partner_url: apiData.partner_url || apiData.action_url,
      partner_id: apiData.partner_id,
      revenue_share: apiData.revenue_share,
      category: apiData.category,
      external_tracking_id: apiData.external_tracking_id,
      conversion_type: apiData.conversion_type,
    });
  }

  /**
   * Отримання партнерського URL з трекінгом
   * @param {string} userId - ID користувача
   * @returns {string} URL для переходу
   */
  getPartnerUrl(userId) {
    return this.getTrackingUrl(userId);
  }

  /**
   * Перевірка, чи є логотип партнера
   * @returns {boolean} Наявність логотипу
   */
  hasLogo() {
    return !!this.partner_logo && this.partner_logo.length > 0;
  }

  /**
   * Отримання категорії партнера
   * @returns {string} Категорія
   */
  getCategory() {
    return this.category || 'Загальна';
  }

  /**
   * Отримання типу конверсії
   * @returns {string} Тип конверсії
   */
  getConversionType() {
    return this.conversion_type || 'visit';
  }
}

export default PartnerTaskModel;
