/**
 * Модель партнерського завдання
 *
 * Розширює базову модель для партнерських завдань
 */

import { TaskModel } from './task-model.js';
import { TASK_TYPES } from '../config/task-types.js';

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

    // Розширюємо додатковими властивостями
    this.partner_name = data.partner_name || '';
    this.partner_logo = data.partner_logo || '';
    this.partner_url = data.partner_url || data.action_url || '';
    this.partner_id = data.partner_id || '';
    this.revenue_share = parseFloat(data.revenue_share) || 0;
    this.category = data.category || '';
    this.external_tracking_id = data.external_tracking_id || '';
    this.conversion_type = data.conversion_type || 'visit';
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
      partner_name: this.partner_name,
      partner_logo: this.partner_logo,
      partner_url: this.partner_url,
      partner_id: this.partner_id,
      revenue_share: this.revenue_share,
      category: this.category,
      external_tracking_id: this.external_tracking_id,
      conversion_type: this.conversion_type
    };
  }

  /**
   * Перетворення в формат для відображення
   * @returns {Object} Дані для відображення
   */
  toDisplayData() {
    // Отримуємо базові дані
    const baseData = super.toDisplayData();

    // Додаємо специфічні дані
    return {
      ...baseData,
      partner_name: this.partner_name,
      partner_logo: this.partner_logo,
      partner_url: this.partner_url,
      category: this.category,
      conversion_type: this.conversion_type,
      isPartner: true
    };
  }

  /**
   * Валідація даних партнерського завдання
   * @returns {boolean} Результат валідації
   */
  isValid() {
    // Викликаємо базову валідацію
    if (!super.isValid()) {
      return false;
    }

    // Валідація партнерських даних
    if (!this.partner_name || !this.partner_url) {
      return false;
    }

    return true;
  }

  /**
   * Створення трекінгового URL з UTM-мітками
   * @param {string} userId - ID користувача
   * @returns {string} URL з трекінгом
   */
  getTrackingUrl(userId) {
    if (!this.partner_url) {
      return '';
    }

    try {
      const url = new URL(this.partner_url);

      // Додаємо базові UTM параметри
      url.searchParams.append('utm_source', 'winix');
      url.searchParams.append('utm_medium', 'quest');
      url.searchParams.append('utm_campaign', this.id);

      // Додаємо ID користувача, якщо є
      if (userId) {
        url.searchParams.append('utm_term', userId);
      }

      // Додаємо партнерський ID та зовнішній трекінг, якщо є
      if (this.partner_id) {
        url.searchParams.append('partner_id', this.partner_id);
      }

      if (this.external_tracking_id) {
        url.searchParams.append('tracking_id', this.external_tracking_id);
      }

      return url.toString();
    } catch (error) {
      console.error('Помилка створення трекінгового URL:', error);
      return this.partner_url;
    }
  }

  /**
   * Створення екземпляра з даних API
   * @param {Object} apiData - Дані від API
   * @returns {PartnerTaskModel} Новий екземпляр партнерського завдання
   */
  static fromApiData(apiData) {
    // Нормалізуємо дані
    const normalizedData = TaskModel.normalize(apiData);

    // Створюємо екземпляр
    return new PartnerTaskModel({
      ...normalizedData,
      partner_name: apiData.partner_name,
      partner_logo: apiData.partner_logo,
      partner_url: apiData.partner_url || apiData.action_url,
      partner_id: apiData.partner_id,
      revenue_share: apiData.revenue_share,
      category: apiData.category,
      external_tracking_id: apiData.external_tracking_id,
      conversion_type: apiData.conversion_type
    });
  }
}

export default PartnerTaskModel;